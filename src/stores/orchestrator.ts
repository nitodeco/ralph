import { getErrorMessage } from "@/lib/errors.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
import { DecompositionHandler, VerificationHandler } from "@/lib/handlers/index.ts";
import { getLogger } from "@/lib/logger.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { appendProgress } from "@/lib/progress.ts";
import type { BranchModeConfig } from "@/lib/services/config/types.ts";
import {
	getConfigService,
	getGitBranchService,
	getGitProviderService,
	getIterationCoordinator,
	getParallelExecutionManager,
	getPrdService,
	getSessionManager,
} from "@/lib/services/index.ts";
import type {
	ParallelExecutionConfig,
	ParallelExecutionSummary,
	ParallelGroupState,
} from "@/lib/services/parallel-execution-manager/types.ts";
import type { PrdTask } from "@/lib/services/prd/types.ts";
import type { Prd, RalphConfig, Session } from "@/types.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

export type {
	ParallelExecutionConfig,
	ParallelExecutionSummary,
	ParallelGroupState,
} from "@/lib/services/parallel-execution-manager/types.ts";
export type {
	ResumeSessionResult,
	StartSessionResult,
} from "@/lib/services/session-manager/types.ts";

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
	parallelExecution?: ParallelExecutionConfig;
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private maxRuntimeMs: number | undefined = undefined;
	private skipVerification = false;
	private unsubscribers: (() => void)[] = [];
	private initialized = false;
	private decompositionHandler: DecompositionHandler | null = null;
	private verificationHandler: VerificationHandler | null = null;

	private parallelConfig: ParallelExecutionConfig = { enabled: false, maxConcurrentTasks: 1 };

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

		const loadedConfig = getConfigService().get();
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

		const loadedConfig = getConfigService().get();
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

		const loadedConfig = getConfigService().get();
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

		const loadedConfig = getConfigService().get();
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
		return getParallelExecutionManager().getCurrentGroup();
	}

	getParallelExecutionGroups(): PrdTask[][] {
		return getParallelExecutionManager().getExecutionGroups();
	}

	initializeParallelExecution(prd: Prd): { isValid: boolean; error?: string } {
		return getParallelExecutionManager().initialize(prd, this.parallelConfig);
	}

	startNextParallelGroup(): { started: boolean; groupIndex: number; tasks: PrdTask[] } {
		return getParallelExecutionManager().startNextGroup();
	}

	recordParallelTaskStart(task: PrdTask, processId: string): void {
		getParallelExecutionManager().recordTaskStart(task, processId);
	}

	recordParallelTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): { groupComplete: boolean; allSucceeded: boolean } {
		return getParallelExecutionManager().recordTaskComplete(
			taskId,
			taskTitle,
			wasSuccessful,
			error,
		);
	}

	getReadyTasksForParallelExecution(): PrdTask[] {
		return getParallelExecutionManager().getReadyTasks();
	}

	hasMoreParallelGroups(): boolean {
		return getParallelExecutionManager().hasMoreGroups();
	}

	getParallelExecutionSummary(): ParallelExecutionSummary {
		return getParallelExecutionManager().getSummary();
	}

	disableParallelExecution(): void {
		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		getParallelExecutionManager().disable();
	}

	private setupSubscriptions(): void {
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const iterationCoordinator = getIterationCoordinator();

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
						iterationCoordinator.setLastRetryContexts(event.retryContexts);
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
		const iterationCoordinator = getIterationCoordinator();

		if (event.retryContexts) {
			iterationCoordinator.setLastRetryContexts(event.retryContexts);
		}

		const prdService = getPrdService();
		const currentPrd = prdService.reload();

		if (event.hasDecompositionRequest && event.decompositionRequest && this.decompositionHandler) {
			const handled = this.decompositionHandler.handle(event.decompositionRequest, currentPrd);

			if (handled) {
				iterationCoordinator.setLastDecomposition(event.decompositionRequest);

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
					const loadedConfig = getConfigService().get();
					const currentPrd = prdService.reload();

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
				const loadedConfig = getConfigService().get();
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

	getConfig(): RalphConfig | null {
		return this.config;
	}

	setupIterationCallbacks(): void {
		if (!this.config) {
			throw new Error("Orchestrator must be initialized before setting up iteration callbacks");
		}

		getIterationCoordinator().setupIterationCallbacks({
			iterations: this.iterations,
			config: this.config,
			skipVerification: this.skipVerification,
			branchModeEnabled: this.branchModeEnabled,
			branchModeConfig: this.branchModeConfig,
		});
	}

	startSession(
		prd: Prd | null,
		totalIterations: number,
	): import("@/lib/services/session-manager/types.ts").StartSessionResult {
		return getSessionManager().startSession(prd, totalIterations);
	}

	resumeSession(
		pendingSession: Session,
		prd: Prd | null,
	): import("@/lib/services/session-manager/types.ts").ResumeSessionResult {
		return getSessionManager().resumeSession(pendingSession, prd);
	}

	handleFatalError(error: string, prd: Prd | null, currentSession: Session | null): Session | null {
		const result = getSessionManager().handleFatalError(error, prd, currentSession);

		return result.session;
	}

	cleanup(): void {
		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.unsubscribers = [];
		this.initialized = false;
		this.decompositionHandler?.reset();
		this.verificationHandler?.reset();
		this.decompositionHandler = null;
		this.verificationHandler = null;

		getIterationCoordinator().clearState();
		getParallelExecutionManager().reset();

		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		this.branchModeEnabled = false;
		this.branchModeConfig = null;
		this.baseBranch = null;
		this.currentTaskBranch = null;

		useIterationStore.getState().clearCallbacks();

		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
