import { loadConfig } from "@/lib/config.ts";
import { parseDecompositionRequest } from "@/lib/decomposition.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
import {
	DecompositionHandler,
	LearningHandler,
	VerificationHandler,
} from "@/lib/handlers/index.ts";
import {
	appendIterationError,
	completeIterationLog,
	generateSessionId,
	initializeLogsIndex,
	startIterationLog,
} from "@/lib/iteration-logs.ts";
import { getLogger } from "@/lib/logger.ts";
import { performIterationCleanup } from "@/lib/memory.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { getCurrentTaskIndex, getNextTaskWithIndex, reloadPrd } from "@/lib/prd.ts";
import { appendProgress, initializeProgressFile } from "@/lib/progress.ts";
import { getSessionMemoryService, getSessionService } from "@/lib/services/index.ts";
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

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
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

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.maxRuntimeMs = options.maxRuntimeMs;
		this.skipVerification = options.skipVerification ?? false;
		this.initialized = true;
		this.lastRetryContexts = [];
		this.lastDecomposition = null;
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
		this.setupSubscriptions();

		const iterationStore = useIterationStore.getState();

		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
	}

	getIsVerifying(): boolean {
		return this.verificationHandler?.getIsRunning() ?? false;
	}

	private setupSubscriptions(): void {
		this.unsubscribers.push(
			eventBus.on("agent:complete", (event) => {
				this.handleAgentComplete(event);
			}),
		);

		this.unsubscribers.push(
			eventBus.on("agent:error", (event) => {
				if (event.retryContexts) {
					this.lastRetryContexts = event.retryContexts;
				}

				if (event.isFatal) {
					const appState = useAppStore.getState();

					this.handleFatalError(event.error, appState.prd, appState.currentSession);
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

		const verificationConfig = this.config?.verification;

		if (
			verificationConfig?.enabled &&
			!this.skipVerification &&
			!allTasksActuallyDone &&
			this.verificationHandler
		) {
			const verificationResult = await this.verificationHandler.run(verificationConfig);

			if (!verificationResult.passed) {
				const iterationStore = useIterationStore.getState();

				iterationStore.markIterationComplete(false);

				return;
			}
		} else {
			this.verificationHandler?.reset();
		}

		const iterationStore = useIterationStore.getState();

		iterationStore.markIterationComplete(allTasksActuallyDone);
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

				agentStore.reset();
				const cleanupResult = performIterationCleanup({ logFilePath: loadedConfig.logFilePath });

				if (cleanupResult.memoryStatus !== "ok") {
					logger.warn("Memory cleanup completed with warnings", {
						status: cleanupResult.memoryStatus,
						tempFilesRemoved: cleanupResult.tempFilesRemoved,
					});
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
		this.decompositionHandler?.reset();
		this.verificationHandler?.reset();
		this.decompositionHandler = null;
		this.verificationHandler = null;
		this.learningHandler = null;
		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
