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
import { getNextTask, getNextTaskWithIndex, loadPrd } from "@/lib/prd.ts";
import {
	logError as logProgressError,
	logIterationComplete as logProgressIterationComplete,
	logIterationStart as logProgressIterationStart,
	logMaxIterationsReached as logProgressMaxIterations,
	logSessionComplete as logProgressSessionComplete,
	logSessionResume as logProgressSessionResume,
	logSessionStart as logProgressSessionStart,
	logSessionStopped as logProgressSessionStopped,
} from "@/lib/progress.ts";
import {
	createSession,
	deleteSession,
	saveSession,
	updateSessionIteration,
	updateSessionStatus,
} from "@/lib/session.ts";
import type { IterationLogStatus, Prd, RalphConfig, Session } from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private unsubscribers: (() => void)[] = [];
	private initialized = false;

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.initialized = true;
		this.setupSubscriptions();
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
				if (previousAgentState.isStreaming && !current.isStreaming && current.exitCode !== null) {
					this.handleAgentComplete(current.isComplete);
				}
				previousAgentState = current;
			}),
		);

		this.unsubscribers.push(
			useIterationStore.subscribe((state) => {
				const agentState = useAgentStore.getState();
				if (state.isRunning && state.current > 0 && !state.isDelaying && !agentState.isStreaming) {
					this.startAgentForIteration();
				}
			}),
		);
	}

	private handleAgentComplete(isProjectComplete: boolean): void {
		const iterationStore = useIterationStore.getState();
		iterationStore.markIterationComplete(isProjectComplete);
	}

	private startAgentForIteration(): void {
		const agentStore = useAgentStore.getState();
		if (!agentStore.isStreaming) {
			agentStore.start();
		}
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
				const currentTask = currentPrd ? getNextTask(currentPrd) : null;
				const taskWithIndex = currentPrd ? getNextTaskWithIndex(currentPrd) : null;
				logProgressIterationStart(iterationNumber, iterations, currentTask ?? undefined);
				useAgentStore.getState().reset();
				if (currentPrd) {
					appState.setPrd(currentPrd);
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
				const taskTitle = currentPrd ? getNextTask(currentPrd) : undefined;
				logProgressIterationComplete(
					iterationNumber,
					iterations,
					agentStore.isComplete,
					taskTitle ?? undefined,
				);
				if (appState.currentSession) {
					const taskIndex = currentPrd ? getCurrentTaskIndex(currentPrd) : 0;
					const updatedSession = updateSessionIteration(
						appState.currentSession,
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

				agentStore.clearOutput();
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
				const totalTasks = currentPrd?.tasks.length ?? 0;
				logProgressSessionComplete(
					currentPrd?.project ?? "Unknown Project",
					iterations,
					totalTasks,
					appState.elapsedTime,
				);
				sendNotifications(loadedConfig.notifications, "complete", currentPrd?.project, {
					totalIterations: iterations,
				});
				useAppStore.setState({ appState: "complete" });
				if (appState.currentSession) {
					const completedSession = updateSessionStatus(appState.currentSession, "completed");
					saveSession(completedSession);
					deleteSession();
					useAppStore.setState({ currentSession: null });
				}
			},
			onMaxIterations: () => {
				const appState = useAppStore.getState();
				const iterationState = useIterationStore.getState();
				useAgentStore.getState().stop();
				const loadedConfig = loadConfig();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
				logger.logMaxIterationsReached(iterationState.total);
				const currentPrd = loadPrd();
				const totalTasks = currentPrd?.tasks.length ?? 0;
				const completedTasks = currentPrd?.tasks.filter((task) => task.done).length ?? 0;
				logProgressMaxIterations(
					currentPrd?.project ?? "Unknown Project",
					iterationState.total,
					completedTasks,
					totalTasks,
				);
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
		});
	}

	startSession(prd: Prd | null, totalIterations: number): Session {
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		const taskIndex = prd ? getCurrentTaskIndex(prd) : 0;
		const newSession = createSession(totalIterations, taskIndex);
		saveSession(newSession);

		logger.logSessionStart(totalIterations, taskIndex);
		const totalTasks = prd?.tasks.length ?? 0;
		const completedTasks = prd?.tasks.filter((task) => task.done).length ?? 0;
		logProgressSessionStart(
			prd?.project ?? "Unknown Project",
			totalIterations,
			totalTasks,
			completedTasks,
		);

		const sessionId = generateSessionId();
		initializeLogsIndex(sessionId, prd?.project ?? "Unknown Project");

		return newSession;
	}

	resumeSession(
		pendingSession: Session,
		prd: Prd | null,
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
		const totalTasks = prd?.tasks.length ?? 0;
		const completedTasks = prd?.tasks.filter((task) => task.done).length ?? 0;
		logProgressSessionResume(
			prd?.project ?? "Unknown Project",
			pendingSession.currentIteration,
			pendingSession.totalIterations,
			totalTasks,
			completedTasks,
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
		logProgressError(iterationState.current, iterationState.total, error, { fatal: true });
		logProgressSessionStopped(
			prd?.project ?? "Unknown Project",
			iterationState.current,
			iterationState.total,
			`Fatal error: ${error}`,
		);
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
