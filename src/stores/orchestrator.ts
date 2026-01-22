import { loadConfig } from "@/lib/config.ts";
import { parseDecompositionRequest } from "@/lib/decomposition.ts";
import {
	getParallelExecutionGroups,
	getReadyTasks,
	validateDependencies,
} from "@/lib/dependency-graph.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
import {
	DecompositionHandler,
	LearningHandler,
	TechnicalDebtHandler,
	VerificationHandler,
} from "@/lib/handlers/index.ts";
import {
	appendIterationError,
	completeIterationLog,
	generateSessionId,
	getAllIterationLogs,
	initializeLogsIndex,
	startIterationLog,
} from "@/lib/iteration-logs.ts";
import { getLogger } from "@/lib/logger.ts";
import { performIterationCleanup } from "@/lib/memory.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { getCurrentTaskIndex, getNextTaskWithIndex, reloadPrd } from "@/lib/prd.ts";
import { appendProgress, initializeProgressFile } from "@/lib/progress.ts";
import type { BranchModeConfig } from "@/lib/services/config/types.ts";
import {
	getGitBranchService,
	getGitProviderService,
	getSessionMemoryService,
	getSessionService,
	getUsageStatisticsService,
} from "@/lib/services/index.ts";
import type { PrdTask } from "@/lib/services/prd/types.ts";
import {
	calculateStatisticsFromLogs,
	displayStatisticsReport,
	logStatisticsToProgress,
} from "@/lib/statistics.ts";
import type {
	DecompositionRequest,
	DecompositionSubtask,
	IterationLogDecomposition,
	IterationLogRetryContext,
	IterationLogStatus,
	IterationLogVerification,
	Prd,
	RalphConfig,
	Session,
} from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

export interface StartSessionResult {
	session: Session;
	taskIndex: number;
}

export interface ResumeSessionResult {
	session: Session;
	remainingIterations: number;
}

export interface ParallelExecutionConfig {
	enabled: boolean;
	maxConcurrentTasks: number;
}

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
	parallelExecution?: ParallelExecutionConfig;
}

interface ParallelGroupState {
	groupIndex: number;
	tasks: PrdTask[];
	completedTaskIds: Set<string>;
	failedTaskIds: Set<string>;
	startTime: number;
}

interface ParallelTaskResult {
	taskId: string;
	taskTitle: string;
	success: boolean;
	error: string | null;
}

function recordUsageStatistics(
	session: Session,
	prd: Prd | null,
	status: "completed" | "stopped" | "failed",
): void {
	const usageStatisticsService = getUsageStatisticsService();
	const completedTasks = prd?.tasks.filter((task) => task.done).length ?? 0;
	const attemptedTasks = prd?.tasks.length ?? 0;
	const durationMs = Date.now() - session.startTime;

	usageStatisticsService.initialize(prd?.project ?? "Unknown Project");
	usageStatisticsService.recordSession({
		sessionId: `session-${session.startTime}`,
		startedAt: new Date(session.startTime).toISOString(),
		completedAt: new Date().toISOString(),
		durationMs,
		totalIterations: session.statistics.totalIterations,
		completedIterations: session.statistics.completedIterations,
		successfulIterations: session.statistics.successfulIterations,
		failedIterations: session.statistics.failedIterations,
		tasksCompleted: completedTasks,
		tasksAttempted: attemptedTasks,
		status,
	});
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private maxRuntimeMs: number | undefined = undefined;
	private skipVerification = false;
	private unsubscribers: (() => void)[] = [];
	private initialized = false;
	private lastRetryContexts: IterationLogRetryContext[] = [];
	private lastDecomposition: DecompositionRequest | null = null;
	private decompositionHandler: DecompositionHandler | null = null;
	private verificationHandler: VerificationHandler | null = null;
	private learningHandler: LearningHandler | null = null;
	private technicalDebtHandler: TechnicalDebtHandler | null = null;

	private parallelConfig: ParallelExecutionConfig = { enabled: false, maxConcurrentTasks: 1 };
	private currentParallelGroup: ParallelGroupState | null = null;
	private parallelExecutionGroups: PrdTask[][] = [];
	private currentGroupIndex = 0;
	private parallelTaskResults: Map<string, ParallelTaskResult> = new Map();

	private branchModeEnabled = false;
	private branchModeConfig: BranchModeConfig | null = null;
	private baseBranch: string | null = null;
	private currentTaskBranch: string | null = null;

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.maxRuntimeMs = options.maxRuntimeMs;
		this.skipVerification = options.skipVerification ?? false;
		this.parallelConfig = options.parallelExecution ?? { enabled: false, maxConcurrentTasks: 1 };
		this.initialized = true;
		this.lastRetryContexts = [];
		this.lastDecomposition = null;
		this.currentParallelGroup = null;
		this.parallelExecutionGroups = [];
		this.currentGroupIndex = 0;
		this.parallelTaskResults.clear();

		this.branchModeEnabled =
			options.config.workflowMode === "branches" || (options.config.branchMode?.enabled ?? false);
		this.branchModeConfig = options.config.branchMode ?? null;
		this.baseBranch = null;
		this.currentTaskBranch = null;
		this.decompositionHandler = new DecompositionHandler({
			config: options.config,
			onPrdUpdate: (prd) => {
				useAppStore.setState({ prd });
			},
			onRestartIteration: () => {
				useIterationStore.getState().restartCurrentIteration();
			},
		});
		this.verificationHandler = new VerificationHandler({
			onStateChange: (isVerifying, result) => {
				useAppStore.setState({ isVerifying, lastVerificationResult: result });
			},
		});
		this.learningHandler = new LearningHandler({
			enabled: options.config.learningEnabled !== false,
			logFilePath: options.config.logFilePath,
		});
		this.technicalDebtHandler = new TechnicalDebtHandler({
			onStateChange: (isReviewing, report) => {
				useAppStore.setState({
					isReviewingTechnicalDebt: isReviewing,
					lastTechnicalDebtReport: report,
				});
			},
		});
		this.setupSubscriptions();

		const iterationStore = useIterationStore.getState();

		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
	}

	getIsVerifying(): boolean {
		return this.verificationHandler?.getIsRunning() ?? false;
	}

	isBranchModeEnabled(): boolean {
		return this.branchModeEnabled;
	}

	getBranchModeConfig(): BranchModeConfig | null {
		return this.branchModeConfig;
	}

	getCurrentTaskBranch(): string | null {
		return this.currentTaskBranch;
	}

	getBaseBranch(): string | null {
		return this.baseBranch;
	}

	initializeBranchMode(): { isValid: boolean; error?: string } {
		if (!this.branchModeEnabled) {
			return { isValid: true };
		}

		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const gitBranchService = getGitBranchService();
		const workingStatus = gitBranchService.getWorkingDirectoryStatus();

		if (!workingStatus.isClean) {
			const errorMessage =
				"Working directory has uncommitted changes. Please commit or stash changes before using branch mode.";

			logger.warn("Branch mode initialization failed: dirty working directory", {
				modifiedFiles: workingStatus.modifiedFiles,
				untrackedFiles: workingStatus.untrackedFiles,
			});

			return { isValid: false, error: errorMessage };
		}

		const branchInfo = gitBranchService.getBranchInfo();

		this.baseBranch = branchInfo.currentBranch;

		logger.info("Branch mode initialized", {
			baseBranch: this.baseBranch,
			hasRemote: branchInfo.hasRemote,
		});

		appendProgress(`=== Branch Mode Enabled ===\nBase branch: ${this.baseBranch}\n`);

		return { isValid: true };
	}

	createTaskBranch(taskTitle: string, taskIndex: number): { success: boolean; error?: string } {
		if (!this.branchModeEnabled || !this.branchModeConfig) {
			return { success: true };
		}

		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const gitBranchService = getGitBranchService();
		const result = gitBranchService.createAndCheckoutTaskBranch(
			taskTitle,
			taskIndex,
			this.branchModeConfig,
		);

		if (result.status === "error") {
			logger.error("Failed to create task branch", {
				taskTitle,
				taskIndex,
				error: result.error,
			});

			return { success: false, error: result.error };
		}

		this.currentTaskBranch = result.branchName ?? null;

		logger.info("Created and checked out task branch", {
			taskTitle,
			taskIndex,
			branchName: this.currentTaskBranch,
		});

		appendProgress(`Switched to branch: ${this.currentTaskBranch}\n`);

		return { success: true };
	}

	async completeTaskBranch(
		prd: Prd | null,
	): Promise<{ success: boolean; error?: string; prUrl?: string }> {
		if (!this.branchModeEnabled || !this.branchModeConfig || !this.currentTaskBranch) {
			return { success: true };
		}

		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const gitBranchService = getGitBranchService();
		const branchName = this.currentTaskBranch;
		const shouldPush = this.branchModeConfig.pushAfterCommit ?? true;
		const shouldReturn = this.branchModeConfig.returnToBaseBranch ?? true;
		let wasPushed = false;

		if (shouldPush) {
			const pushResult = gitBranchService.pushBranch(branchName);

			if (pushResult.status === "error") {
				logger.warn("Failed to push branch", {
					branchName,
					error: pushResult.error,
				});
				appendProgress(`Warning: Failed to push branch ${branchName}: ${pushResult.error}\n`);
			} else if (pushResult.status === "success") {
				logger.info("Pushed branch", { branchName });
				appendProgress(`Pushed branch: ${branchName}\n`);
				wasPushed = true;
			} else {
				appendProgress(`Skipped push: ${pushResult.message}\n`);
			}
		}

		let prUrl: string | undefined;

		if (wasPushed) {
			const prResult = await this.createPullRequestForBranch(branchName, prd);

			if (prResult.prUrl) {
				prUrl = prResult.prUrl;
			}
		}

		if (shouldReturn && this.baseBranch) {
			const returnResult = gitBranchService.returnToBaseBranch(this.baseBranch);

			if (returnResult.status === "error") {
				logger.error("Failed to return to base branch", {
					baseBranch: this.baseBranch,
					error: returnResult.error,
				});

				return { success: false, error: returnResult.error };
			}

			logger.info("Returned to base branch", { baseBranch: this.baseBranch });
			appendProgress(`Returned to base branch: ${this.baseBranch}\n`);
		}

		this.currentTaskBranch = null;

		return { success: true, prUrl };
	}

	async createPullRequestForBranch(
		branchName: string,
		prd: Prd | null,
	): Promise<{ success: boolean; prUrl?: string; error?: string }> {
		if (!this.branchModeEnabled || !this.baseBranch) {
			return { success: false, error: "Branch mode not enabled or no base branch" };
		}

		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const gitProviderConfig = loadedConfig.gitProvider;

		if (!gitProviderConfig?.autoCreatePr) {
			logger.info("Auto PR creation disabled, skipping", { branchName });

			return { success: true };
		}

		const gitBranchService = getGitBranchService();
		const remoteUrl = gitBranchService.getRemoteUrl();

		if (!remoteUrl) {
			logger.warn("No remote URL found, cannot create PR", { branchName });

			return { success: false, error: "No remote URL configured" };
		}

		const gitProviderService = getGitProviderService();
		const remoteInfo = gitProviderService.detectProvider(remoteUrl);

		if (remoteInfo.provider === "none") {
			logger.warn("Unknown git provider, cannot create PR", { remoteUrl });

			return { success: false, error: `Unknown git provider for remote: ${remoteUrl}` };
		}

		const provider = gitProviderService.getProvider(remoteInfo);

		if (!provider) {
			logger.warn("Git provider not configured", {
				provider: remoteInfo.provider,
				branchName,
			});

			return { success: false, error: `${remoteInfo.provider} provider not configured` };
		}

		if (!provider.isConfigured) {
			logger.warn("Git provider token not configured", {
				provider: remoteInfo.provider,
				branchName,
			});

			return {
				success: false,
				error: `${remoteInfo.provider} token not configured`,
			};
		}

		const prTitle = prd?.project
			? `[Ralph] ${prd.project}: ${branchName}`
			: `[Ralph] ${branchName}`;

		const prBody = this.generatePrBody(prd, branchName);

		try {
			const result = await provider.createPullRequest({
				title: prTitle,
				body: prBody,
				head: branchName,
				base: this.baseBranch,
				isDraft: gitProviderConfig.prDraft ?? false,
				labels: gitProviderConfig.prLabels,
				reviewers: gitProviderConfig.prReviewers,
			});

			if (!result.success || !result.data) {
				logger.error("Failed to create PR", {
					branchName,
					error: result.error,
				});

				eventBus.emit("session:pr_failed", {
					branchName,
					baseBranch: this.baseBranch,
					error: result.error ?? "Unknown error",
				});

				return { success: false, error: result.error };
			}

			logger.info("Created pull request", {
				prNumber: result.data.number,
				prUrl: result.data.url,
				branchName,
				baseBranch: this.baseBranch,
			});

			appendProgress(
				`\n=== Pull Request Created ===\nPR #${result.data.number}: ${result.data.url}\n`,
			);

			eventBus.emit("session:pr_created", {
				prNumber: result.data.number,
				prUrl: result.data.url,
				branchName,
				baseBranch: this.baseBranch,
				isDraft: result.data.isDraft,
			});

			return { success: true, prUrl: result.data.url };
		} catch (error) {
			const errorMessage = getErrorMessage(error);

			logger.error("Failed to create PR", {
				branchName,
				error: errorMessage,
			});

			eventBus.emit("session:pr_failed", {
				branchName,
				baseBranch: this.baseBranch,
				error: errorMessage,
			});

			return { success: false, error: errorMessage };
		}
	}

	private generatePrBody(prd: Prd | null, branchName: string): string {
		const lines: string[] = ["## Summary", ""];

		if (prd?.project) {
			lines.push(`Automated PR created by Ralph for project: **${prd.project}**`);
		} else {
			lines.push("Automated PR created by Ralph.");
		}

		lines.push("");
		lines.push(`Branch: \`${branchName}\``);

		if (prd?.tasks && prd.tasks.length > 0) {
			const completedTasks = prd.tasks.filter((task) => task.done);
			const totalTasks = prd.tasks.length;

			lines.push("");
			lines.push("## Tasks Completed");
			lines.push("");
			lines.push(`${completedTasks.length} / ${totalTasks} tasks completed.`);
			lines.push("");

			for (const task of completedTasks) {
				lines.push(`- [x] ${task.title}`);
			}
		}

		lines.push("");
		lines.push("---");
		lines.push("*This PR was automatically created by [Ralph](https://github.com/your-org/ralph)*");

		return lines.join("\n");
	}

	isParallelModeEnabled(): boolean {
		return this.parallelConfig.enabled;
	}

	getParallelConfig(): ParallelExecutionConfig {
		return { ...this.parallelConfig };
	}

	getCurrentParallelGroup(): ParallelGroupState | null {
		return this.currentParallelGroup;
	}

	getParallelExecutionGroups(): PrdTask[][] {
		return [...this.parallelExecutionGroups];
	}

	initializeParallelExecution(prd: Prd): { isValid: boolean; error?: string } {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		if (!this.parallelConfig.enabled) {
			return { isValid: true };
		}

		const validationResult = validateDependencies(prd);

		if (!validationResult.isValid) {
			const errorMessages = validationResult.errors
				.map((err) => `${err.type}: ${err.details}`)
				.join("; ");

			logger.error("Dependency validation failed for parallel execution", {
				errors: validationResult.errors,
			});

			return { isValid: false, error: `Invalid task dependencies: ${errorMessages}` };
		}

		this.parallelExecutionGroups = getParallelExecutionGroups(prd);
		this.currentGroupIndex = 0;

		logger.info("Initialized parallel execution", {
			totalGroups: this.parallelExecutionGroups.length,
			maxConcurrentTasks: this.parallelConfig.maxConcurrentTasks,
		});

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const parallelSession = sessionService.enableParallelMode(
				appState.currentSession,
				this.parallelConfig.maxConcurrentTasks,
			);

			sessionService.save(parallelSession);
			useAppStore.setState({ currentSession: parallelSession });
		}

		return { isValid: true };
	}

	startNextParallelGroup(): { started: boolean; groupIndex: number; tasks: PrdTask[] } {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		if (this.currentGroupIndex >= this.parallelExecutionGroups.length) {
			logger.info("All parallel groups completed");

			return { started: false, groupIndex: -1, tasks: [] };
		}

		const currentGroup = this.parallelExecutionGroups.at(this.currentGroupIndex);

		if (!currentGroup || currentGroup.length === 0) {
			logger.warn("Empty parallel group encountered", { groupIndex: this.currentGroupIndex });
			this.currentGroupIndex++;

			return this.startNextParallelGroup();
		}

		const tasksToExecute = currentGroup.slice(0, this.parallelConfig.maxConcurrentTasks);

		this.currentParallelGroup = {
			groupIndex: this.currentGroupIndex,
			tasks: tasksToExecute,
			completedTaskIds: new Set(),
			failedTaskIds: new Set(),
			startTime: Date.now(),
		};

		this.parallelTaskResults.clear();

		logger.info("Starting parallel group", {
			groupIndex: this.currentGroupIndex,
			taskCount: tasksToExecute.length,
			taskTitles: tasksToExecute.map((task) => task.title),
		});

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.startParallelGroup(
				appState.currentSession,
				this.currentGroupIndex,
			);

			sessionService.save(updatedSession);
			useAppStore.setState({ currentSession: updatedSession });
		}

		eventBus.emit("parallel:group_start", {
			groupIndex: this.currentGroupIndex,
			taskCount: tasksToExecute.length,
			taskTitles: tasksToExecute.map((task) => task.title),
		});

		return { started: true, groupIndex: this.currentGroupIndex, tasks: tasksToExecute };
	}

	recordParallelTaskStart(task: PrdTask, processId: string): void {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		logger.info("Parallel task started", {
			taskId: task.id,
			taskTitle: task.title,
			processId,
			groupIndex: this.currentGroupIndex,
		});

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const taskIndex = appState.prd?.tasks.findIndex((t) => t.title === task.title) ?? -1;
			const updatedSession = sessionService.startTaskExecution(appState.currentSession, {
				taskId: task.id ?? `task-${taskIndex}`,
				taskTitle: task.title,
				taskIndex,
				processId,
			});

			sessionService.save(updatedSession);
			useAppStore.setState({ currentSession: updatedSession });
		}

		eventBus.emit("parallel:task_start", {
			taskId: task.id,
			taskTitle: task.title,
			processId,
			groupIndex: this.currentGroupIndex,
		});
	}

	recordParallelTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): { groupComplete: boolean; allSucceeded: boolean } {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		if (!this.currentParallelGroup) {
			logger.warn("No active parallel group when recording task completion", { taskId });

			return { groupComplete: true, allSucceeded: false };
		}

		this.parallelTaskResults.set(taskId, {
			taskId,
			taskTitle,
			success: wasSuccessful,
			error: error ?? null,
		});

		if (wasSuccessful) {
			this.currentParallelGroup.completedTaskIds.add(taskId);
		} else {
			this.currentParallelGroup.failedTaskIds.add(taskId);
		}

		logger.info("Parallel task completed", {
			taskId,
			taskTitle,
			wasSuccessful,
			completedCount: this.currentParallelGroup.completedTaskIds.size,
			failedCount: this.currentParallelGroup.failedTaskIds.size,
			totalInGroup: this.currentParallelGroup.tasks.length,
		});

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = wasSuccessful
				? sessionService.completeTaskExecution(appState.currentSession, taskId, true)
				: sessionService.failTaskExecution(
						appState.currentSession,
						taskId,
						error ?? "Unknown error",
					);

			sessionService.save(updatedSession);
			useAppStore.setState({ currentSession: updatedSession });
		}

		eventBus.emit("parallel:task_complete", {
			taskId,
			taskTitle,
			wasSuccessful,
			groupIndex: this.currentGroupIndex,
		});

		const totalCompleted =
			this.currentParallelGroup.completedTaskIds.size +
			this.currentParallelGroup.failedTaskIds.size;
		const isGroupComplete = totalCompleted >= this.currentParallelGroup.tasks.length;
		const allSucceeded = this.currentParallelGroup.failedTaskIds.size === 0;

		if (isGroupComplete) {
			this.completeCurrentParallelGroup();
		}

		return {
			groupComplete: isGroupComplete,
			allSucceeded,
		};
	}

	private completeCurrentParallelGroup(): void {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		if (!this.currentParallelGroup) {
			return;
		}

		const durationMs = Date.now() - this.currentParallelGroup.startTime;
		const allSucceeded = this.currentParallelGroup.failedTaskIds.size === 0;

		logger.info("Parallel group completed", {
			groupIndex: this.currentParallelGroup.groupIndex,
			completedCount: this.currentParallelGroup.completedTaskIds.size,
			failedCount: this.currentParallelGroup.failedTaskIds.size,
			durationMs,
			allSucceeded,
		});

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.completeParallelGroup(
				appState.currentSession,
				this.currentParallelGroup.groupIndex,
			);

			sessionService.save(updatedSession);
			useAppStore.setState({ currentSession: updatedSession });
		}

		eventBus.emit("parallel:group_complete", {
			groupIndex: this.currentParallelGroup.groupIndex,
			completedCount: this.currentParallelGroup.completedTaskIds.size,
			failedCount: this.currentParallelGroup.failedTaskIds.size,
			durationMs,
			allSucceeded,
		});

		appendProgress(
			`=== Parallel Group ${this.currentParallelGroup.groupIndex + 1} Complete ===\n` +
				`Completed: ${this.currentParallelGroup.completedTaskIds.size}, ` +
				`Failed: ${this.currentParallelGroup.failedTaskIds.size}, ` +
				`Duration: ${Math.round(durationMs / 1000)}s\n`,
		);

		this.currentGroupIndex++;
		this.currentParallelGroup = null;
	}

	getReadyTasksForParallelExecution(): PrdTask[] {
		const prd = reloadPrd();

		if (!prd) {
			return [];
		}

		const readyTasks = getReadyTasks(prd);

		return readyTasks
			.filter((taskInfo) => !taskInfo.task.done)
			.map((taskInfo) => taskInfo.task)
			.slice(0, this.parallelConfig.maxConcurrentTasks);
	}

	hasMoreParallelGroups(): boolean {
		return this.currentGroupIndex < this.parallelExecutionGroups.length;
	}

	getParallelExecutionSummary(): {
		totalGroups: number;
		completedGroups: number;
		currentGroupIndex: number;
		isActive: boolean;
	} {
		return {
			totalGroups: this.parallelExecutionGroups.length,
			completedGroups: this.currentGroupIndex,
			currentGroupIndex: this.currentGroupIndex,
			isActive: this.currentParallelGroup !== null,
		};
	}

	disableParallelExecution(): void {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		if (!this.parallelConfig.enabled) {
			return;
		}

		logger.info("Disabling parallel execution");

		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		this.currentParallelGroup = null;
		this.parallelExecutionGroups = [];
		this.currentGroupIndex = 0;
		this.parallelTaskResults.clear();

		const appState = useAppStore.getState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.disableParallelMode(appState.currentSession);

			sessionService.save(updatedSession);
			useAppStore.setState({ currentSession: updatedSession });
		}
	}

	private setupSubscriptions(): void {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		this.unsubscribers.push(
			eventBus.on("agent:complete", (event) => {
				try {
					this.handleAgentComplete(event).catch((error) => {
						logger.error("Error in handleAgentComplete", { error: getErrorMessage(error) });

						const iterationStore = useIterationStore.getState();

						iterationStore.markIterationComplete(false, true);
					});
				} catch (error) {
					logger.error("Sync error in agent:complete handler", { error: getErrorMessage(error) });

					const iterationStore = useIterationStore.getState();

					iterationStore.markIterationComplete(false, true);
				}
			}),
		);

		this.unsubscribers.push(
			eventBus.on("agent:error", (event) => {
				try {
					if (event.retryContexts) {
						this.lastRetryContexts = event.retryContexts;
					}

					if (event.isFatal) {
						const appState = useAppStore.getState();

						this.handleFatalError(event.error, appState.prd, appState.currentSession);
						useAppStore.setState({ appState: "error" });
					}
				} catch (error) {
					logger.error("Error in agent:error handler", { error: getErrorMessage(error) });
					useAppStore.setState({ appState: "error" });
				}
			}),
		);
	}

	private async handleAgentComplete(event: AgentCompleteEvent): Promise<void> {
		if (event.retryContexts) {
			this.lastRetryContexts = event.retryContexts;
			this.logRetryContextsToProgress(event.retryContexts);
		}

		const currentPrd = reloadPrd();
		const decompositionResult = parseDecompositionRequest(event.output);

		if (decompositionResult.detected && decompositionResult.request && this.decompositionHandler) {
			const handled = this.decompositionHandler.handle(decompositionResult.request, currentPrd);

			if (handled) {
				this.lastDecomposition = decompositionResult.request;
				useAppStore.setState({ lastDecomposition: decompositionResult.request });

				return;
			}
		}

		const allTasksActuallyDone = currentPrd
			? currentPrd.tasks.length > 0 && currentPrd.tasks.every((task) => task.done)
			: false;

		const hasPendingTasks = currentPrd ? currentPrd.tasks.some((task) => !task.done) : false;

		const verificationConfig = this.config?.verification;

		if (
			verificationConfig?.enabled &&
			!this.skipVerification &&
			!allTasksActuallyDone &&
			this.verificationHandler
		) {
			try {
				const verificationResult = await this.verificationHandler.run(verificationConfig);

				if (!verificationResult.passed) {
					const iterationStore = useIterationStore.getState();
					const loadedConfig = loadConfig();
					const currentPrd = reloadPrd();

					sendNotifications(
						loadedConfig.notifications,
						"verification_failed",
						currentPrd?.project,
						{
							failedChecks: verificationResult.failedChecks,
							iteration: iterationStore.current,
						},
					);

					iterationStore.markIterationComplete(false, hasPendingTasks);

					return;
				}
			} catch (verificationError) {
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.error("Verification handler threw an error, continuing without verification", {
					error: getErrorMessage(verificationError),
				});
				this.verificationHandler?.reset();
			}
		} else {
			this.verificationHandler?.reset();
		}

		const iterationStore = useIterationStore.getState();

		iterationStore.markIterationComplete(allTasksActuallyDone, hasPendingTasks);
	}

	private logRetryContextsToProgress(retryContexts: IterationLogRetryContext[]): void {
		if (retryContexts.length === 0) {
			return;
		}

		const lines: string[] = ["=== Retry Analysis ==="];

		for (const context of retryContexts) {
			lines.push(`Retry attempt ${context.attemptNumber}:`);
			lines.push(`  Category: ${context.failureCategory}`);
			lines.push(`  Root cause: ${context.rootCause}`);
		}

		lines.push("");

		appendProgress(lines.join("\n"));
	}

	getConfig(): RalphConfig | null {
		return this.config;
	}

	setupIterationCallbacks(): void {
		const iterationStore = useIterationStore.getState();
		const iterations = this.iterations;

		iterationStore.setCallbacks({
			onIterationStart: (iterationNumber: number) => {
				const appState = useAppStore.getState();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.logIterationStart(iterationNumber, iterations);
				const currentPrd = reloadPrd();
				const taskWithIndex = currentPrd ? getNextTaskWithIndex(currentPrd) : null;

				useAgentStore.getState().reset();

				if (currentPrd) {
					appState.setPrd(currentPrd);
				}

				if (appState.currentSession) {
					const sessionService = getSessionService();
					const updatedSession = sessionService.recordIterationStart(
						appState.currentSession,
						iterationNumber,
					);

					sessionService.save(updatedSession);
					useAppStore.setState({ currentSession: updatedSession });
				}

				startIterationLog({
					iteration: iterationNumber,
					totalIterations: iterations,
					task: taskWithIndex
						? { title: taskWithIndex.title, index: taskWithIndex.index, wasCompleted: false }
						: null,
					agentType: loadedConfig.agent,
				});

				if (this.branchModeEnabled && taskWithIndex) {
					const branchResult = this.createTaskBranch(taskWithIndex.title, taskWithIndex.index);

					if (!branchResult.success) {
						logger.error("Failed to create task branch, continuing without branch mode", {
							error: branchResult.error,
						});
					}
				}

				const specificTask = appState.getEffectiveNextTask();

				if (specificTask && appState.manualNextTask) {
					appState.clearManualNextTask();
				}

				useAgentStore.getState().start(specificTask);
			},
			onIterationComplete: (iterationNumber: number) => {
				const appState = useAppStore.getState();
				const agentStore = useAgentStore.getState();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.logIterationComplete(iterationNumber, iterations, agentStore.isComplete);
				const currentPrd = reloadPrd();

				if (appState.currentSession) {
					const sessionService = getSessionService();
					const wasSuccessful = !agentStore.error && agentStore.isComplete;
					let updatedSession = sessionService.recordIterationEnd(
						appState.currentSession,
						iterationNumber,
						wasSuccessful,
					);
					const taskIndex = currentPrd ? getCurrentTaskIndex(currentPrd) : 0;

					updatedSession = sessionService.updateIteration(
						updatedSession,
						iterationNumber,
						taskIndex,
						appState.elapsedTime,
					);
					sessionService.save(updatedSession);
					useAppStore.setState({ currentSession: updatedSession });
				}

				const lastVerificationResult = this.verificationHandler?.getLastResult() ?? null;
				const verificationFailed = lastVerificationResult ? !lastVerificationResult.passed : false;
				const wasDecomposed = this.lastDecomposition !== null;

				const iterationStatus: IterationLogStatus = agentStore.error
					? "failed"
					: wasDecomposed
						? "decomposed"
						: verificationFailed
							? "verification_failed"
							: agentStore.isComplete
								? "completed"
								: "completed";

				const taskWithIndex = currentPrd ? getNextTaskWithIndex(currentPrd) : null;
				const taskTitle = taskWithIndex?.title ?? "Unknown task";
				const wasSuccessful = !agentStore.error && agentStore.isComplete && !verificationFailed;
				const failedChecks = lastVerificationResult ? lastVerificationResult.failedChecks : [];

				try {
					this.learningHandler?.recordIterationOutcome({
						iteration: iterationNumber,
						wasSuccessful,
						agentError: agentStore.error,
						output: agentStore.output,
						exitCode: agentStore.exitCode,
						taskTitle,
						retryCount: agentStore.retryCount,
						retryContexts: this.lastRetryContexts,
						verificationFailed,
						failedChecks,
					});
				} catch (learningError) {
					logger.warn("Learning handler threw an error", {
						error: getErrorMessage(learningError),
					});
				}

				const retryContextsForLog =
					this.lastRetryContexts.length > 0 ? [...this.lastRetryContexts] : undefined;

				this.lastRetryContexts = [];

				const verificationForLog: IterationLogVerification | undefined = lastVerificationResult
					? {
							ran: true,
							passed: lastVerificationResult.passed,
							checks: lastVerificationResult.checks.map((check) => ({
								name: check.name,
								passed: check.passed,
								durationMs: check.durationMs,
							})),
							failedChecks: lastVerificationResult.failedChecks,
							totalDurationMs: lastVerificationResult.totalDurationMs,
						}
					: undefined;

				this.verificationHandler?.reset();

				const decompositionForLog: IterationLogDecomposition | undefined = this.lastDecomposition
					? {
							originalTaskTitle: this.lastDecomposition.originalTaskTitle,
							reason: this.lastDecomposition.reason,
							subtasksCreated: this.lastDecomposition.suggestedSubtasks.map(
								(subtask: DecompositionSubtask) => subtask.title,
							),
						}
					: undefined;

				this.lastDecomposition = null;
				useAppStore.setState({ lastDecomposition: null });

				try {
					completeIterationLog({
						iteration: iterationNumber,
						status: iterationStatus,
						exitCode: agentStore.exitCode,
						retryCount: agentStore.retryCount,
						outputLength: agentStore.output.length,
						taskWasCompleted: agentStore.isComplete,
						retryContexts: retryContextsForLog,
						verification: verificationForLog,
						decomposition: decompositionForLog,
					});
				} catch (logError) {
					logger.warn("Failed to complete iteration log", {
						error: getErrorMessage(logError),
					});
				}

				if (this.branchModeEnabled && wasSuccessful && agentStore.isComplete) {
					const currentPrd = reloadPrd();

					this.completeTaskBranch(currentPrd).then((branchResult) => {
						if (!branchResult.success) {
							logger.error("Failed to complete task branch workflow", {
								error: branchResult.error,
							});
						}
					});
				}

				agentStore.reset();

				try {
					const cleanupResult = performIterationCleanup({ logFilePath: loadedConfig.logFilePath });

					if (cleanupResult.memoryStatus !== "ok") {
						logger.warn("Memory cleanup completed with warnings", {
							status: cleanupResult.memoryStatus,
							tempFilesRemoved: cleanupResult.tempFilesRemoved,
						});
					}
				} catch (cleanupError) {
					logger.warn("Memory cleanup failed", { error: getErrorMessage(cleanupError) });
				}
			},
			onAllComplete: () => {
				const appState = useAppStore.getState();

				useAgentStore.getState().stop();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.logSessionComplete();
				const currentPrd = reloadPrd();

				sendNotifications(loadedConfig.notifications, "complete", currentPrd?.project, {
					totalIterations: iterations,
				});

				if (appState.currentSession) {
					const sessionService = getSessionService();
					const finalStatistics = calculateStatisticsFromLogs(appState.currentSession);

					displayStatisticsReport(finalStatistics);
					logStatisticsToProgress(finalStatistics);

					if (this.technicalDebtHandler) {
						try {
							const iterationLogs = getAllIterationLogs();
							const sessionId = `session-${appState.currentSession.startTime}`;
							const technicalDebtReport = this.technicalDebtHandler.run(
								sessionId,
								iterationLogs,
								finalStatistics,
								this.config?.technicalDebtReview,
							);

							if (technicalDebtReport.totalItems > 0) {
								eventBus.emit("session:technical_debt_review", {
									totalItems: technicalDebtReport.totalItems,
									criticalItems: technicalDebtReport.itemsBySeverity.critical,
									highItems: technicalDebtReport.itemsBySeverity.high,
									hasRecommendations: technicalDebtReport.recommendations.length > 0,
								});
							}
						} catch (debtReviewError) {
							logger.warn("Technical debt review failed", {
								error: getErrorMessage(debtReviewError),
							});
						}
					}

					recordUsageStatistics(appState.currentSession, currentPrd, "completed");

					const completedSession = sessionService.updateStatus(
						appState.currentSession,
						"completed",
					);

					sessionService.save(completedSession);
					sessionService.delete();
					useAppStore.setState({ currentSession: null });
				}

				eventBus.emit("session:complete", { totalIterations: iterations });
				useAppStore.setState({ appState: "complete" });
			},
			onMaxIterations: () => {
				const appState = useAppStore.getState();
				const iterationState = useIterationStore.getState();

				useAgentStore.getState().stop();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.logMaxIterationsReached(iterationState.total);
				const currentPrd = reloadPrd();

				sendNotifications(loadedConfig.notifications, "max_iterations", currentPrd?.project, {
					completedIterations: iterationState.current,
					totalIterations: iterationState.total,
				});

				if (appState.currentSession) {
					recordUsageStatistics(appState.currentSession, currentPrd, "stopped");

					const sessionService = getSessionService();
					const stoppedSession = sessionService.updateStatus(appState.currentSession, "stopped");

					sessionService.save(stoppedSession);
					useAppStore.setState({ currentSession: stoppedSession });
				}

				eventBus.emit("session:stop", { reason: "max_iterations" });
				useAppStore.setState({ appState: "max_iterations" });
			},
			onMaxRuntime: () => {
				const appState = useAppStore.getState();
				const iterationState = useIterationStore.getState();

				useAgentStore.getState().stop();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.info("Max runtime limit reached", {
					maxRuntimeMs: iterationState.maxRuntimeMs,
					completedIterations: iterationState.current,
				});
				const currentPrd = reloadPrd();

				sendNotifications(loadedConfig.notifications, "max_iterations", currentPrd?.project, {
					completedIterations: iterationState.current,
					totalIterations: iterationState.total,
					reason: "max_runtime",
				});

				if (appState.currentSession) {
					recordUsageStatistics(appState.currentSession, currentPrd, "stopped");

					const sessionService = getSessionService();
					const stoppedSession = sessionService.updateStatus(appState.currentSession, "stopped");

					sessionService.save(stoppedSession);
					useAppStore.setState({ currentSession: stoppedSession });
				}

				eventBus.emit("session:stop", { reason: "max_runtime" });
				useAppStore.setState({ appState: "max_runtime" });
			},
		});
	}

	startSession(prd: Prd | null, totalIterations: number): StartSessionResult {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const sessionService = getSessionService();

		const taskIndex = prd ? getCurrentTaskIndex(prd) : 0;
		const newSession = sessionService.create(totalIterations, taskIndex);

		sessionService.save(newSession);

		logger.logSessionStart(totalIterations, taskIndex);
		initializeProgressFile();

		const sessionId = generateSessionId();

		initializeLogsIndex(sessionId, prd?.project ?? "Unknown Project");

		getSessionMemoryService().initialize(prd?.project ?? "Unknown Project");

		eventBus.emit("session:start", { totalIterations, taskIndex });

		return { session: newSession, taskIndex };
	}

	resumeSession(pendingSession: Session, _prd: Prd | null): ResumeSessionResult {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const sessionService = getSessionService();

		const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;
		const resumedSession = sessionService.updateStatus(pendingSession, "running");

		sessionService.save(resumedSession);

		logger.logSessionResume(
			pendingSession.currentIteration,
			pendingSession.totalIterations,
			pendingSession.elapsedTimeSeconds,
		);

		eventBus.emit("session:resume", {
			currentIteration: pendingSession.currentIteration,
			totalIterations: pendingSession.totalIterations,
			elapsedTimeSeconds: pendingSession.elapsedTimeSeconds,
		});

		return {
			session: resumedSession,
			remainingIterations: remainingIterations > 0 ? remainingIterations : 1,
		};
	}

	handleFatalError(error: string, prd: Prd | null, currentSession: Session | null): Session | null {
		const iterationState = useIterationStore.getState();
		const agentStore = useAgentStore.getState();
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		logger.error("Fatal error occurred", { error });
		sendNotifications(loadedConfig.notifications, "fatal_error", prd?.project, { error });

		appendIterationError(iterationState.current, error, { fatal: true });
		completeIterationLog({
			iteration: iterationState.current,
			status: "failed",
			exitCode: agentStore.exitCode,
			retryCount: agentStore.retryCount,
			outputLength: agentStore.output.length,
			taskWasCompleted: false,
		});

		eventBus.emit("session:stop", { reason: "fatal_error" });

		if (currentSession) {
			recordUsageStatistics(currentSession, prd, "failed");

			const sessionService = getSessionService();
			const stoppedSession = sessionService.updateStatus(currentSession, "stopped");

			sessionService.save(stoppedSession);

			return stoppedSession;
		}

		return null;
	}

	cleanup(): void {
		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.unsubscribers = [];
		this.initialized = false;
		this.lastRetryContexts = [];
		this.lastDecomposition = null;
		this.decompositionHandler?.reset();
		this.verificationHandler?.reset();
		this.technicalDebtHandler?.reset();
		this.decompositionHandler = null;
		this.verificationHandler = null;
		this.learningHandler = null;
		this.technicalDebtHandler = null;

		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		this.currentParallelGroup = null;
		this.parallelExecutionGroups = [];
		this.currentGroupIndex = 0;
		this.parallelTaskResults.clear();

		this.branchModeEnabled = false;
		this.branchModeConfig = null;
		this.baseBranch = null;
		this.currentTaskBranch = null;

		useIterationStore.getState().clearCallbacks();

		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
