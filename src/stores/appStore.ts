import { existsSync } from "node:fs";
import { create } from "zustand";
import { loadConfig } from "@/lib/config.ts";
import { getLogger } from "@/lib/logger.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { findPrdFile, getNextTask, loadPrd, RALPH_DIR } from "@/lib/prd.ts";
import {
	logError as logProgressError,
	logIterationComplete as logProgressIterationComplete,
	logIterationStart as logProgressIterationStart,
	logMaxIterationsReached as logProgressMaxIterations,
	logSessionComplete as logProgressSessionComplete,
	logSessionResume as logProgressSessionResume,
	logSessionStart as logProgressSessionStart,
	logSessionStopped as logProgressSessionStopped,
	PROGRESS_FILE_PATH,
} from "@/lib/progress.ts";
import {
	createSession,
	deleteSession,
	isSessionResumable,
	loadSession,
	saveSession,
	updateSessionIteration,
	updateSessionStatus,
} from "@/lib/session.ts";
import type { Prd, RalphConfig, Session } from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useIterationStore } from "./iterationStore.ts";

export type AppState =
	| "idle"
	| "running"
	| "complete"
	| "error"
	| "max_iterations"
	| "not_initialized"
	| "resume_prompt";

export type ActiveView = "run" | "init" | "setup" | "update" | "help" | "add";

export interface ValidationWarning {
	message: string;
	hint: string;
}

interface AppStoreState {
	appState: AppState;
	activeView: ActiveView;
	validationWarning: ValidationWarning | null;
	config: RalphConfig | null;
	prd: Prd | null;
	elapsedTime: number;
	pendingSession: Session | null;
	currentSession: Session | null;
	iterations: number;
}

interface AppStoreActions {
	setAppState: (state: AppState) => void;
	setActiveView: (view: ActiveView) => void;
	setIterations: (iterations: number) => void;
	incrementElapsedTime: () => void;
	resetElapsedTime: () => void;
	loadInitialState: (autoResume: boolean) => void;
	startIterations: (iterationCount?: number, full?: boolean) => void;
	resumeSession: () => void;
	stopAgent: () => void;
	revalidateAndGoIdle: () => void;
	handleAgentComplete: () => void;
	handleFatalError: (error: string) => void;
	setPrd: (prd: Prd | null) => void;
}

type AppStore = AppStoreState & AppStoreActions;

const DEFAULT_ITERATIONS = 10;

function validateProject(): ValidationWarning | null {
	const prdFile = findPrdFile();
	if (!prdFile) {
		return {
			message: `No prd.json or prd.yaml found in ${RALPH_DIR}/`,
			hint: "Run 'ralph init' or type /init to create one",
		};
	}

	if (!existsSync(PROGRESS_FILE_PATH)) {
		return {
			message: `No ${PROGRESS_FILE_PATH} found`,
			hint: "Run 'ralph init' or type /init to create one",
		};
	}

	return null;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

export const useAppStore = create<AppStore>((set, get) => ({
	appState: "idle",
	activeView: "run",
	validationWarning: null,
	config: null,
	prd: null,
	elapsedTime: 0,
	pendingSession: null,
	currentSession: null,
	iterations: DEFAULT_ITERATIONS,

	setAppState: (appState: AppState) => {
		set({ appState });
	},

	setActiveView: (activeView: ActiveView) => {
		set({ activeView });
	},

	setIterations: (iterations: number) => {
		set({ iterations });
	},

	incrementElapsedTime: () => {
		set((state) => ({ elapsedTime: state.elapsedTime + 1 }));
	},

	resetElapsedTime: () => {
		set({ elapsedTime: 0 });
	},

	setPrd: (prd: Prd | null) => {
		set({ prd });
	},

	loadInitialState: (autoResume: boolean) => {
		const warning = validateProject();
		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		set({
			config: loadedConfig,
			prd: loadedPrd,
		});

		const existingSession = loadSession();
		if (isSessionResumable(existingSession)) {
			set({ pendingSession: existingSession });
			if (autoResume) {
				set({ appState: "idle" });
			} else {
				set({ appState: "resume_prompt" });
			}
		} else {
			set({ appState: "idle" });
		}
	},

	startIterations: (iterationCount?: number, full?: boolean) => {
		const state = get();
		const warning = validateProject();
		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
		});

		deleteSession();
		set({ pendingSession: null });

		let totalIters = iterationCount || state.iterations || DEFAULT_ITERATIONS;
		if (full && loadedPrd) {
			const incompleteTasks = loadedPrd.tasks.filter((task) => !task.done).length;
			totalIters = incompleteTasks > 0 ? incompleteTasks : 1;
		}

		const iterationStore = useIterationStore.getState();
		iterationStore.setTotal(totalIters);

		const taskIndex = loadedPrd ? getCurrentTaskIndex(loadedPrd) : 0;
		const newSession = createSession(totalIters, taskIndex);
		saveSession(newSession);
		set({ currentSession: newSession });

		logger.logSessionStart(totalIters, taskIndex);
		const totalTasks = loadedPrd?.tasks.length ?? 0;
		const completedTasks = loadedPrd?.tasks.filter((task) => task.done).length ?? 0;
		logProgressSessionStart(
			loadedPrd?.project ?? "Unknown Project",
			totalIters,
			totalTasks,
			completedTasks,
		);

		set({
			appState: "running",
			elapsedTime: 0,
		});

		useAgentStore.getState().reset();
		iterationStore.start();
	},

	resumeSession: () => {
		const state = get();
		if (!state.pendingSession) {
			return;
		}

		const warning = validateProject();
		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
		});

		const remainingIterations =
			state.pendingSession.totalIterations - state.pendingSession.currentIteration;

		const iterationStore = useIterationStore.getState();
		iterationStore.setTotal(remainingIterations > 0 ? remainingIterations : 1);

		const resumedSession = updateSessionStatus(state.pendingSession, "running");
		saveSession(resumedSession);
		set({
			currentSession: resumedSession,
			pendingSession: null,
		});

		logger.logSessionResume(
			state.pendingSession.currentIteration,
			state.pendingSession.totalIterations,
			state.pendingSession.elapsedTimeSeconds,
		);
		const totalTasks = loadedPrd?.tasks.length ?? 0;
		const completedTasks = loadedPrd?.tasks.filter((task) => task.done).length ?? 0;
		logProgressSessionResume(
			loadedPrd?.project ?? "Unknown Project",
			state.pendingSession.currentIteration,
			state.pendingSession.totalIterations,
			totalTasks,
			completedTasks,
		);

		set({
			appState: "running",
			elapsedTime: state.pendingSession.elapsedTimeSeconds,
		});

		useAgentStore.getState().reset();
		iterationStore.start();
	},

	stopAgent: () => {
		const agentStore = useAgentStore.getState();
		const iterationStore = useIterationStore.getState();
		const state = get();

		if (agentStore.isStreaming) {
			agentStore.stop();
			iterationStore.stop();
			if (state.currentSession) {
				const pausedSession = updateSessionStatus(state.currentSession, "paused");
				saveSession(pausedSession);
				set({ currentSession: pausedSession });
			}
			set({ appState: "idle" });
		}
	},

	revalidateAndGoIdle: () => {
		const warning = validateProject();
		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			appState: "idle",
			elapsedTime: 0,
		});

		useAgentStore.getState().reset();
	},

	handleAgentComplete: () => {
		const agentStore = useAgentStore.getState();
		const iterationStore = useIterationStore.getState();
		iterationStore.markIterationComplete(agentStore.isComplete);
	},

	handleFatalError: (error: string) => {
		const state = get();
		const iterationState = useIterationStore.getState();
		const loadedConfig = loadConfig();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		logger.error("Fatal error occurred", { error });
		logProgressError(iterationState.current, iterationState.total, error, { fatal: true });
		logProgressSessionStopped(
			state.prd?.project ?? "Unknown Project",
			iterationState.current,
			iterationState.total,
			`Fatal error: ${error}`,
		);
		sendNotifications(loadedConfig.notifications, "fatal_error", state.prd?.project, {
			error,
		});
		if (state.currentSession) {
			const stoppedSession = updateSessionStatus(state.currentSession, "stopped");
			saveSession(stoppedSession);
			set({ currentSession: stoppedSession });
		}
		set({ appState: "error" });
	},
}));

export function setupIterationCallbacks(iterations: number) {
	const iterationStore = useIterationStore.getState();

	iterationStore.setCallbacks({
		onIterationStart: (iterationNumber: number) => {
			const appState = useAppStore.getState();
			const loadedConfig = loadConfig();
			const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
			logger.logIterationStart(iterationNumber, iterations);
			const currentPrd = loadPrd();
			const currentTask = currentPrd ? getNextTask(currentPrd) : null;
			logProgressIterationStart(iterationNumber, iterations, currentTask ?? undefined);
			useAgentStore.getState().reset();
			if (currentPrd) {
				appState.setPrd(currentPrd);
			}
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
