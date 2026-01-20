import { loadConfig } from "@/lib/config.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
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
import {
	createSession,
	deleteSession,
	recordIterationEnd,
	recordIterationStart,
	saveSession,
	updateSessionIteration,
	updateSessionStatus,
} from "@/lib/session.ts";
import {
	calculateStatisticsFromLogs,
	displayStatisticsReport,
	logStatisticsToProgress,
} from "@/lib/statistics.ts";
import type {
	IterationLogRetryContext,
	IterationLogStatus,
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
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private maxRuntimeMs: number | undefined = undefined;
	private unsubscribers: (() => void)[] = [];
	private initialized = false;
	private lastRetryContexts: IterationLogRetryContext[] = [];

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.maxRuntimeMs = options.maxRuntimeMs;
		this.initialized = true;
		this.lastRetryContexts = [];
		this.setupSubscriptions();

		const iterationStore = useIterationStore.getState();
		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
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

	private handleAgentComplete(event: AgentCompleteEvent): void {
		if (event.retryContexts) {
			this.lastRetryContexts = event.retryContexts;
			this.logRetryContextsToProgress(event.retryContexts);
		}

		const currentPrd = reloadPrd();
		const allTasksActuallyDone = currentPrd
			? currentPrd.tasks.length > 0 && currentPrd.tasks.every((task) => task.done)
			: false;

		const iterationStore = useIterationStore.getState();
		iterationStore.markIterationComplete(allTasksActuallyDone);
	}

	private logRetryContextsToProgress(retryContexts: IterationLogRetryContext[]): void {
		if (retryContexts.length === 0) return;

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
					const updatedSession = recordIterationStart(appState.currentSession, iterationNumber);
					saveSession(updatedSession);
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
					const wasSuccessful = !agentStore.error && agentStore.isComplete;
					let updatedSession = recordIterationEnd(
						appState.currentSession,
						iterationNumber,
						wasSuccessful,
					);
					const taskIndex = currentPrd ? getCurrentTaskIndex(currentPrd) : 0;
					updatedSession = updateSessionIteration(
						updatedSession,
						iterationNumber,
						taskIndex,
						appState.elapsedTime,
					);
					saveSession(updatedSession);
					useAppStore.setState({ currentSession: updatedSession });
				}

				const iterationStatus: IterationLogStatus = agentStore.error
					? "failed"
					: agentStore.isComplete
						? "completed"
						: "completed";

				const retryContextsForLog =
					this.lastRetryContexts.length > 0 ? [...this.lastRetryContexts] : undefined;
				this.lastRetryContexts = [];

				completeIterationLog({
					iteration: iterationNumber,
					status: iterationStatus,
					exitCode: agentStore.exitCode,
					retryCount: agentStore.retryCount,
					outputLength: agentStore.output.length,
					taskWasCompleted: agentStore.isComplete,
					retryContexts: retryContextsForLog,
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
					const finalStatistics = calculateStatisticsFromLogs(appState.currentSession);
					displayStatisticsReport(finalStatistics);
					logStatisticsToProgress(finalStatistics);
					const completedSession = updateSessionStatus(appState.currentSession, "completed");
					saveSession(completedSession);
					deleteSession();
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
					const stoppedSession = updateSessionStatus(appState.currentSession, "stopped");
					saveSession(stoppedSession);
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
					const stoppedSession = updateSessionStatus(appState.currentSession, "stopped");
					saveSession(stoppedSession);
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

		const taskIndex = prd ? getCurrentTaskIndex(prd) : 0;
		const newSession = createSession(totalIterations, taskIndex);
		saveSession(newSession);

		logger.logSessionStart(totalIterations, taskIndex);
		initializeProgressFile();

		const sessionId = generateSessionId();
		initializeLogsIndex(sessionId, prd?.project ?? "Unknown Project");

		eventBus.emit("session:start", { totalIterations, taskIndex });

		return { session: newSession, taskIndex };
	}

	resumeSession(pendingSession: Session, _prd: Prd | null): ResumeSessionResult {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;
		const resumedSession = updateSessionStatus(pendingSession, "running");
		saveSession(resumedSession);

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
			const stoppedSession = updateSessionStatus(currentSession, "stopped");
			saveSession(stoppedSession);
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
		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
