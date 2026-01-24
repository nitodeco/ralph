import { getErrorMessage } from "@/lib/errors.ts";
import {
	DecompositionHandler,
	LearningHandler,
	TechnicalDebtHandler,
	VerificationHandler,
} from "@/lib/handlers/index.ts";
import {
	completeIterationLog,
	iterateIterationLogs,
	startIterationLog,
} from "@/lib/iteration-logs.ts";
import { getLogger } from "@/lib/logger.ts";
import { performIterationCleanup } from "@/lib/memory.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { appendProgress } from "@/lib/progress.ts";
import {
	calculateStatisticsFromLogs,
	displayStatisticsReport,
	logStatisticsToProgress,
} from "@/lib/statistics.ts";
import type { AppState } from "@/types/app.types.ts";
import type {
	DecompositionRequest,
	DecompositionSubtask,
	IterationLog,
	IterationLogDecomposition,
	IterationLogRetryContext,
	IterationLogStatus,
	IterationLogVerification,
	Prd,
	RalphConfig,
} from "@/types.ts";
import type { BranchModeConfig } from "../config/types.ts";
import {
	getConfigService,
	getPrdService,
	getSessionManager,
	getSessionService,
} from "../container.ts";
import type { IterationCallbackOptions, IterationCoordinator } from "./types.ts";

export interface IterationCoordinatorDependencies {
	getAppStoreState: () => {
		prd: Prd | null;
		currentSession: import("../session/types.ts").Session | null;
		elapsedTime: number;
		manualNextTask: string | null;
		isVerifying: boolean;
		isReviewingTechnicalDebt: boolean;
		lastVerificationResult: import("@/types.ts").VerificationResult | null;
		lastTechnicalDebtReport:
			| import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
			| null;
		lastDecomposition: DecompositionRequest | null;
		getEffectiveNextTask: () => string | null;
		clearManualNextTask: () => void;
		setPrd: (prd: Prd) => void;
	};
	setAppStoreState: (
		state: Partial<{
			prd: Prd | null;
			currentSession: import("../session/types.ts").Session | null;
			isVerifying: boolean;
			isReviewingTechnicalDebt: boolean;
			lastVerificationResult: import("@/types.ts").VerificationResult | null;
			lastTechnicalDebtReport:
				| import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
				| null;
			lastDecomposition: DecompositionRequest | null;
			appState: AppState;
		}>,
	) => void;
	getAgentStoreState: () => {
		isComplete: boolean;
		error: string | null;
		output: string;
		exitCode: number | null;
		retryCount: number;
		reset: () => void;
	};
	getIterationStoreState: () => {
		current: number;
		total: number;
		setCallbacks: (callbacks: {
			onIterationStart?: (iteration: number) => void;
			onIterationComplete?: (iteration: number) => void;
			onAllComplete?: () => void;
			onMaxIterations?: () => void;
			onMaxRuntime?: () => void;
		}) => void;
		restartCurrentIteration: () => void;
	};
	startAgent: (specificTask?: string | null) => void;
	stopAgent: () => void;
	resetAgent: () => void;
	createTaskBranch: (taskTitle: string, taskIndex: number) => { success: boolean; error?: string };
	completeTaskBranch: (
		prd: Prd | null,
	) => Promise<{ success: boolean; error?: string; prUrl?: string }>;
}

export function createIterationCoordinator(
	dependencies: IterationCoordinatorDependencies,
): IterationCoordinator {
	let lastRetryContexts: IterationLogRetryContext[] = [];
	let lastDecomposition: DecompositionRequest | null = null;
	let decompositionHandler: DecompositionHandler | null = null;
	let verificationHandler: VerificationHandler | null = null;
	let learningHandler: LearningHandler | null = null;
	let technicalDebtHandler: TechnicalDebtHandler | null = null;

	function logRetryContextsToProgress(retryContexts: IterationLogRetryContext[]): void {
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

	function setupIterationCallbacks(options: IterationCallbackOptions): void {
		const { iterations, config, skipVerification, branchModeEnabled, branchModeConfig } = options;
		const iterationStore = dependencies.getIterationStoreState();

		decompositionHandler = new DecompositionHandler({
			config,
			onPrdUpdate: (prd) => {
				dependencies.setAppStoreState({ prd });
			},
			onRestartIteration: () => {
				dependencies.getIterationStoreState().restartCurrentIteration();
			},
		});

		verificationHandler = new VerificationHandler({
			onStateChange: (isVerifying, result) => {
				dependencies.setAppStoreState({ isVerifying, lastVerificationResult: result });
			},
		});

		learningHandler = new LearningHandler({
			enabled: config.learningEnabled !== false,
			logFilePath: config.logFilePath,
		});

		technicalDebtHandler = new TechnicalDebtHandler({
			onStateChange: (isReviewing, report) => {
				dependencies.setAppStoreState({
					isReviewingTechnicalDebt: isReviewing,
					lastTechnicalDebtReport: report,
				});
			},
		});

		iterationStore.setCallbacks({
			onIterationStart: (iterationNumber: number) => {
				handleIterationStart(iterationNumber, iterations, branchModeEnabled, branchModeConfig);
			},
			onIterationComplete: (iterationNumber: number) => {
				handleIterationComplete(
					iterationNumber,
					iterations,
					config,
					skipVerification,
					branchModeEnabled,
				);
			},
			onAllComplete: () => {
				handleAllComplete(iterations, config);
			},
			onMaxIterations: () => {
				handleMaxIterations();
			},
			onMaxRuntime: () => {
				handleMaxRuntime();
			},
		});
	}

	function handleIterationStart(
		iterationNumber: number,
		totalIterations: number,
		branchModeEnabled: boolean,
		_branchModeConfig: BranchModeConfig | null,
	): void {
		const appState = dependencies.getAppStoreState();
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const prdService = getPrdService();

		logger.logIterationStart(iterationNumber, totalIterations);
		const currentPrd = prdService.reload();
		const taskWithIndex = currentPrd ? prdService.getNextTaskWithIndex(currentPrd) : null;

		dependencies.resetAgent();

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
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}

		startIterationLog({
			iteration: iterationNumber,
			totalIterations,
			task: taskWithIndex
				? { title: taskWithIndex.title, index: taskWithIndex.index, wasCompleted: false }
				: null,
			agentType: loadedConfig.agent,
		});

		if (branchModeEnabled && taskWithIndex) {
			const branchResult = dependencies.createTaskBranch(taskWithIndex.title, taskWithIndex.index);

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

		dependencies.startAgent(specificTask);
	}

	function handleIterationComplete(
		iterationNumber: number,
		totalIterations: number,
		_config: RalphConfig,
		_skipVerification: boolean,
		branchModeEnabled: boolean,
	): void {
		const appState = dependencies.getAppStoreState();
		const agentStore = dependencies.getAgentStoreState();
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const prdService = getPrdService();

		logger.logIterationComplete(iterationNumber, totalIterations, agentStore.isComplete);
		const currentPrd = prdService.reload();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const wasSuccessful = !agentStore.error && agentStore.isComplete;
			let updatedSession = sessionService.recordIterationEnd(
				appState.currentSession,
				iterationNumber,
				wasSuccessful,
			);
			const taskIndex = currentPrd ? prdService.getCurrentTaskIndex(currentPrd) : 0;

			updatedSession = sessionService.updateIteration(
				updatedSession,
				iterationNumber,
				taskIndex,
				appState.elapsedTime,
			);
			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}

		const lastVerificationResult = verificationHandler?.getLastResult() ?? null;
		const verificationFailed = lastVerificationResult ? !lastVerificationResult.passed : false;
		const wasDecomposed = lastDecomposition !== null;

		const iterationStatus: IterationLogStatus = agentStore.error
			? "failed"
			: wasDecomposed
				? "decomposed"
				: verificationFailed
					? "verification_failed"
					: agentStore.isComplete
						? "completed"
						: "completed";

		const taskWithIndex = currentPrd ? prdService.getNextTaskWithIndex(currentPrd) : null;
		const taskTitle = taskWithIndex?.title ?? "Unknown task";
		const wasSuccessful = !agentStore.error && agentStore.isComplete && !verificationFailed;
		const failedChecks = lastVerificationResult ? lastVerificationResult.failedChecks : [];

		try {
			learningHandler?.recordIterationOutcome({
				iteration: iterationNumber,
				wasSuccessful,
				agentError: agentStore.error,
				output: agentStore.output,
				exitCode: agentStore.exitCode,
				taskTitle,
				retryCount: agentStore.retryCount,
				retryContexts: lastRetryContexts,
				verificationFailed,
				failedChecks,
			});
		} catch (learningError) {
			logger.warn("Learning handler threw an error", {
				error: getErrorMessage(learningError),
			});
		}

		const retryContextsForLog = lastRetryContexts.length > 0 ? [...lastRetryContexts] : undefined;

		lastRetryContexts = [];

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

		verificationHandler?.reset();

		const decompositionForLog: IterationLogDecomposition | undefined = lastDecomposition
			? {
					originalTaskTitle: lastDecomposition.originalTaskTitle,
					reason: lastDecomposition.reason,
					subtasksCreated: lastDecomposition.suggestedSubtasks.map(
						(subtask: DecompositionSubtask) => subtask.title,
					),
				}
			: undefined;

		lastDecomposition = null;
		dependencies.setAppStoreState({ lastDecomposition: null });

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

		if (branchModeEnabled && wasSuccessful && agentStore.isComplete) {
			const reloadedPrd = prdService.reload();

			dependencies.completeTaskBranch(reloadedPrd).then((branchResult) => {
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
	}

	function handleAllComplete(totalIterations: number, config: RalphConfig): void {
		const appState = dependencies.getAppStoreState();

		dependencies.stopAgent();
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		logger.logSessionComplete();
		const currentPrd = getPrdService().reload();

		sendNotifications(loadedConfig.notifications, "complete", currentPrd?.project, {
			totalIterations,
		});

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const finalStatistics = calculateStatisticsFromLogs(appState.currentSession);

			displayStatisticsReport(finalStatistics);
			logStatisticsToProgress(finalStatistics);

			if (technicalDebtHandler) {
				try {
					const MAX_LOGS_FOR_ANALYSIS = 100;
					const iterationLogs: IterationLog[] = [];

					for (const log of iterateIterationLogs()) {
						iterationLogs.push(log);

						if (iterationLogs.length >= MAX_LOGS_FOR_ANALYSIS) {
							break;
						}
					}

					const sessionId = `session-${appState.currentSession.startTime}`;

					technicalDebtHandler.run(
						sessionId,
						iterationLogs,
						finalStatistics,
						config.technicalDebtReview,
					);
				} catch (debtReviewError) {
					logger.warn("Technical debt review failed", {
						error: getErrorMessage(debtReviewError),
					});
				}
			}

			getSessionManager().recordUsageStatistics(appState.currentSession, currentPrd, "completed");

			const completedSession = sessionService.updateStatus(appState.currentSession, "completed");

			sessionService.save(completedSession);
			sessionService.delete();
			dependencies.setAppStoreState({ currentSession: null });
		}

		dependencies.setAppStoreState({ appState: "complete" });
	}

	function handleMaxIterations(): void {
		const appState = dependencies.getAppStoreState();
		const iterationState = dependencies.getIterationStoreState();

		dependencies.stopAgent();
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		logger.logMaxIterationsReached(iterationState.total);
		const currentPrd = getPrdService().reload();

		sendNotifications(loadedConfig.notifications, "max_iterations", currentPrd?.project, {
			completedIterations: iterationState.current,
			totalIterations: iterationState.total,
		});

		if (appState.currentSession) {
			getSessionManager().recordUsageStatistics(appState.currentSession, currentPrd, "stopped");

			const sessionService = getSessionService();
			const stoppedSession = sessionService.updateStatus(appState.currentSession, "stopped");

			sessionService.save(stoppedSession);
			dependencies.setAppStoreState({ currentSession: stoppedSession });
		}

		dependencies.setAppStoreState({ appState: "max_iterations" });
	}

	function handleMaxRuntime(): void {
		const appState = dependencies.getAppStoreState();
		const iterationState = dependencies.getIterationStoreState();

		dependencies.stopAgent();
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		logger.info("Max runtime limit reached", {
			maxRuntimeMs: (iterationState as { maxRuntimeMs?: number }).maxRuntimeMs,
			completedIterations: iterationState.current,
		});
		const currentPrd = getPrdService().reload();

		sendNotifications(loadedConfig.notifications, "max_iterations", currentPrd?.project, {
			completedIterations: iterationState.current,
			totalIterations: iterationState.total,
			reason: "max_runtime",
		});

		if (appState.currentSession) {
			getSessionManager().recordUsageStatistics(appState.currentSession, currentPrd, "stopped");

			const sessionService = getSessionService();
			const stoppedSession = sessionService.updateStatus(appState.currentSession, "stopped");

			sessionService.save(stoppedSession);
			dependencies.setAppStoreState({ currentSession: stoppedSession });
		}

		dependencies.setAppStoreState({ appState: "max_runtime" });
	}

	function getLastRetryContexts(): IterationLogRetryContext[] {
		return lastRetryContexts;
	}

	function getLastDecomposition(): DecompositionRequest | null {
		return lastDecomposition;
	}

	function setLastRetryContexts(contexts: IterationLogRetryContext[]): void {
		lastRetryContexts = contexts;
		logRetryContextsToProgress(contexts);
	}

	function setLastDecomposition(decomposition: DecompositionRequest | null): void {
		lastDecomposition = decomposition;
		dependencies.setAppStoreState({ lastDecomposition: decomposition });
	}

	function clearState(): void {
		lastRetryContexts = [];
		lastDecomposition = null;
		decompositionHandler?.reset();
		verificationHandler?.reset();
		technicalDebtHandler?.reset();
		decompositionHandler = null;
		verificationHandler = null;
		learningHandler = null;
		technicalDebtHandler = null;
	}

	return {
		setupIterationCallbacks,
		getLastRetryContexts,
		getLastDecomposition,
		setLastRetryContexts,
		setLastDecomposition,
		clearState,
	};
}
