import { loadConfig } from "@/lib/config.ts";
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
import { getNextTaskWithIndex, loadPrd } from "@/lib/prd.ts";
import { initializeProgressFile } from "@/lib/progress.ts";
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
import type { IterationLogStatus, Prd, RalphConfig, Session } from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private maxRuntimeMs: number | undefined = undefined;
	private unsubscribers: (() => void)[] = [];
	private initialized = false;

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.maxRuntimeMs = options.maxRuntimeMs;
		this.initialized = true;
		this.setupSubscriptions();

		const iterationStore = useIterationStore.getState();
		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
	}

	private setupSubscriptions(): void {
		let previousAgentState = {
			isStreaming: useAgentStore.getState().isStreaming,
			exitCode: useAgentStore.getState().exitCode,
			isComplete: useAgentStore.getState().isComplete,
		};

		this.unsubscribers.push(
			useAgentStore.subscribe((state) => {
				const current = {
					isStreaming: state.isStreaming,
					exitCode: state.exitCode,
					isComplete: state.isComplete,
				};
				const shouldComplete =
					previousAgentState.isStreaming && !current.isStreaming && current.exitCode !== null;
				previousAgentState = current;
				if (shouldComplete) {
					this.handleAgentComplete(current.isComplete);
				}
			}),
		);
	}

	private handleAgentComplete(_agentClaimsComplete: boolean): void {
		const currentPrd = loadPrd();
		const allTasksActuallyDone = currentPrd
			? currentPrd.tasks.length > 0 && currentPrd.tasks.every((task) => task.done)
			: false;

		const iterationStore = useIterationStore.getState();
		iterationStore.markIterationComplete(allTasksActuallyDone);
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
				const currentPrd = loadPrd();
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
			},
			onIterationComplete: (iterationNumber: number) => {
				const appState = useAppStore.getState();
				const agentStore = useAgentStore.getState();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
				logger.logIterationComplete(iterationNumber, iterations, agentStore.isComplete);
				const currentPrd = loadPrd();
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

				completeIterationLog({
					iteration: iterationNumber,
					status: iterationStatus,
					exitCode: agentStore.exitCode,
					retryCount: agentStore.retryCount,
					outputLength: agentStore.output.length,
					taskWasCompleted: agentStore.isComplete,
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
				const currentPrd = loadPrd();
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
				useAppStore.setState({ appState: "complete" });
			},
			onMaxIterations: () => {
				const appState = useAppStore.getState();
				const iterationState = useIterationStore.getState();
				useAgentStore.getState().stop();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
				logger.logMaxIterationsReached(iterationState.total);
				const currentPrd = loadPrd();
				sendNotifications(loadedConfig.notifications, "max_iterations", currentPrd?.project, {
					completedIterations: iterationState.current,
					totalIterations: iterationState.total,
				});
				if (appState.currentSession) {
					const stoppedSession = updateSessionStatus(appState.currentSession, "stopped");
					saveSession(stoppedSession);
					useAppStore.setState({ currentSession: stoppedSession });
				}
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
				const currentPrd = loadPrd();
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
				useAppStore.setState({ appState: "max_runtime" });
			},
		});
	}

	startSession(prd: Prd | null, totalIterations: number): Session {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		const taskIndex = prd ? getCurrentTaskIndex(prd) : 0;
		const newSession = createSession(totalIterations, taskIndex);
		saveSession(newSession);

		logger.logSessionStart(totalIterations, taskIndex);
		initializeProgressFile();

		const sessionId = generateSessionId();
		initializeLogsIndex(sessionId, prd?.project ?? "Unknown Project");

		return newSession;
	}

	resumeSession(
		pendingSession: Session,
		_prd: Prd | null,
	): { session: Session; remainingIterations: number } {
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

		return {
			session: resumedSession,
			remainingIterations: remainingIterations > 0 ? remainingIterations : 1,
		};
	}

	handleFatalError(error: string, prd: Prd | null, currentSession: Session | null): void {
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

		if (currentSession) {
			const stoppedSession = updateSessionStatus(currentSession, "stopped");
			saveSession(stoppedSession);
			return;
		}
	}

	cleanup(): void {
		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}
		this.unsubscribers = [];
		this.initialized = false;
	}
}

export const orchestrator = new SessionOrchestrator();
