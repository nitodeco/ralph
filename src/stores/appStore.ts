import { create } from "zustand";
import { performSessionArchive } from "@/lib/archive.ts";
import { invalidateConfigCache, loadConfig } from "@/lib/config.ts";
import { DEFAULTS } from "@/lib/defaults.ts";
import { createError, ErrorCode, getErrorSuggestion } from "@/lib/errors.ts";
import { eventBus } from "@/lib/events.ts";
import { RALPH_DIR } from "@/lib/paths.ts";
import {
	canWorkOnTask,
	findPrdFile,
	getNextTask,
	getTaskByIndex,
	getTaskByTitle,
	invalidatePrdCache,
	loadPrd,
} from "@/lib/prd.ts";
import {
	deleteSession,
	isSessionResumable,
	loadSession,
	saveSession,
	updateSessionStatus,
} from "@/lib/session.ts";
import type {
	ActiveView,
	AppState,
	Prd,
	PrdTask,
	RalphConfig,
	Session,
	SetManualTaskResult,
	ValidationWarning,
} from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useIterationStore } from "./iterationStore.ts";
import { orchestrator } from "./orchestrator.ts";

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
	manualNextTask: string | null;
	singleTaskMode: boolean;
	maxRuntimeMs: number | null;
}

interface AppStoreActions {
	setAppState: (state: AppState) => void;
	setActiveView: (view: ActiveView) => void;
	setIterations: (iterations: number) => void;
	setMaxRuntimeMs: (maxRuntimeMs: number | null) => void;
	incrementElapsedTime: () => void;
	resetElapsedTime: () => void;
	loadInitialState: (autoResume: boolean) => void;
	startIterations: (iterationCount?: number, full?: boolean) => void;
	startSingleTask: (taskIdentifier: string) => SetManualTaskResult;
	resumeSession: () => void;
	stopAgent: () => void;
	revalidateAndGoIdle: () => void;
	handleAgentComplete: () => void;
	handleFatalError: (error: string) => void;
	setPrd: (prd: Prd | null) => void;
	setManualNextTask: (taskIdentifier: string) => SetManualTaskResult;
	clearManualNextTask: () => void;
	getEffectiveNextTask: () => string | null;
	getRemainingRuntimeMs: () => number | null;
}

type AppStore = AppStoreState & AppStoreActions;

function validateProject(): ValidationWarning | null {
	const prdFile = findPrdFile();
	if (!prdFile) {
		return {
			message: `No prd.json or prd.yaml found in ${RALPH_DIR}/`,
			hint: "Run 'ralph init' or type /init to create one",
		};
	}

	return null;
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
	iterations: DEFAULTS.iterations,
	singleTaskMode: false,
	manualNextTask: null,
	maxRuntimeMs: null,

	setAppState: (appState: AppState) => {
		set({ appState });
	},

	setActiveView: (activeView: ActiveView) => {
		set({ activeView });
	},

	setIterations: (iterations: number) => {
		set({ iterations });
	},

	setMaxRuntimeMs: (maxRuntimeMs: number | null) => {
		set({ maxRuntimeMs });
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

		performSessionArchive();

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
		});

		deleteSession();
		set({ pendingSession: null });

		let totalIters = iterationCount || state.iterations || DEFAULTS.iterations;
		if (full && loadedPrd) {
			const incompleteTasks = loadedPrd.tasks.filter((task) => !task.done).length;
			totalIters = incompleteTasks > 0 ? incompleteTasks : 1;
		}

		const iterationStore = useIterationStore.getState();
		iterationStore.setTotal(totalIters);
		iterationStore.setStartTime(Date.now());

		const { session: newSession } = orchestrator.startSession(loadedPrd, totalIters);
		set({ currentSession: newSession });

		set({
			appState: "running",
			elapsedTime: 0,
		});

		useAgentStore.getState().reset();
		iterationStore.start();
	},

	startSingleTask: (taskIdentifier: string): SetManualTaskResult => {
		const warning = validateProject();
		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});
			return { success: false, error: warning.message };
		}

		performSessionArchive();

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		if (!loadedPrd) {
			const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD loaded");
			return {
				success: false,
				error: error.suggestion ? `${error.message}. ${error.suggestion}` : error.message,
			};
		}

		const taskIndex = Number.parseInt(taskIdentifier, 10);
		let task: PrdTask | null = null;

		if (!Number.isNaN(taskIndex) && taskIndex > 0 && taskIndex <= loadedPrd.tasks.length) {
			task = getTaskByIndex(loadedPrd, taskIndex - 1);
		} else {
			task = getTaskByTitle(loadedPrd, taskIdentifier);
		}

		if (!task) {
			const availableTasks = loadedPrd.tasks
				.filter((prdTask) => !prdTask.done)
				.map((prdTask, index) => `  ${index + 1}. ${prdTask.title}`)
				.join("\n");
			return {
				success: false,
				error: `Task not found: "${taskIdentifier}"\n\nAvailable pending tasks:\n${availableTasks}`,
			};
		}

		const canWork = canWorkOnTask(task);
		if (!canWork.canWork) {
			return { success: false, error: canWork.reason };
		}

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			manualNextTask: task.title,
			singleTaskMode: true,
		});

		deleteSession();
		set({ pendingSession: null });

		const iterationStore = useIterationStore.getState();
		iterationStore.setTotal(1);
		iterationStore.setStartTime(Date.now());

		const { session: newSession } = orchestrator.startSession(loadedPrd, 1);
		set({ currentSession: newSession });

		set({
			appState: "running",
			elapsedTime: 0,
		});

		useAgentStore.getState().reset();
		iterationStore.start();

		return { success: true, taskTitle: task.title };
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

		performSessionArchive();

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
		});

		const { session: resumedSession, remainingIterations } = orchestrator.resumeSession(
			state.pendingSession,
			loadedPrd,
		);

		const iterationStore = useIterationStore.getState();
		iterationStore.setTotal(remainingIterations);

		const elapsedMs = state.pendingSession.elapsedTimeSeconds * 1000;
		iterationStore.setStartTime(Date.now() - elapsedMs);

		set({
			currentSession: resumedSession,
			pendingSession: null,
		});

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

		if (agentStore.isStreaming || iterationStore.isRunning) {
			agentStore.stop();
			iterationStore.stop();
			if (state.currentSession) {
				const stoppedSession = updateSessionStatus(state.currentSession, "stopped");
				saveSession(stoppedSession);
				set({ currentSession: stoppedSession });
			}
			eventBus.emit("session:stop", { reason: "user_stop" });
			set({ appState: "idle" });
		}
	},

	revalidateAndGoIdle: () => {
		invalidateConfigCache();
		invalidatePrdCache();

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
		const stoppedSession = orchestrator.handleFatalError(error, state.prd, state.currentSession);
		if (stoppedSession) {
			set({ currentSession: stoppedSession });
		}
		set({ appState: "error" });
	},

	setManualNextTask: (taskIdentifier: string): SetManualTaskResult => {
		const state = get();
		const prd = state.prd ?? loadPrd();

		if (!prd) {
			const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD loaded");
			return {
				success: false,
				error: error.suggestion ? `${error.message}. ${error.suggestion}` : error.message,
			};
		}

		const taskIndex = Number.parseInt(taskIdentifier, 10);
		const task = Number.isNaN(taskIndex)
			? getTaskByTitle(prd, taskIdentifier)
			: getTaskByIndex(prd, taskIndex - 1);

		if (!task) {
			const availableTasks = prd.tasks
				.map((prdTask, index) => `  ${index + 1}. ${prdTask.title}`)
				.join("\n");
			const suggestion = getErrorSuggestion(ErrorCode.PRD_TASK_NOT_FOUND);
			return {
				success: false,
				error: `Task not found: "${taskIdentifier}"\n\nAvailable tasks:\n${availableTasks}\n\n${suggestion}`,
			};
		}

		const canWork = canWorkOnTask(task);
		if (!canWork.canWork) {
			return {
				success: false,
				error: canWork.reason ?? "Cannot work on this task",
			};
		}

		set({ manualNextTask: task.title });
		return { success: true, taskTitle: task.title };
	},

	clearManualNextTask: () => {
		set({ manualNextTask: null });
	},

	getEffectiveNextTask: (): string | null => {
		const state = get();
		if (state.manualNextTask) {
			const prd = state.prd ?? loadPrd();
			if (prd) {
				const task = getTaskByTitle(prd, state.manualNextTask);
				if (task && !task.done) {
					return state.manualNextTask;
				}
			}
			set({ manualNextTask: null });
		}
		const prd = state.prd ?? loadPrd();
		return prd ? getNextTask(prd) : null;
	},

	getRemainingRuntimeMs: (): number | null => {
		const state = get();
		if (state.maxRuntimeMs === null) {
			return null;
		}
		const elapsedMs = state.elapsedTime * 1000;
		const remaining = state.maxRuntimeMs - elapsedMs;
		return remaining > 0 ? remaining : 0;
	},
}));

export function setupIterationCallbacks(iterations: number, maxRuntimeMs?: number) {
	const loadedConfig = loadConfig();
	const effectiveMaxRuntimeMs = maxRuntimeMs ?? loadedConfig.maxRuntimeMs;
	orchestrator.initialize({
		config: loadedConfig,
		iterations,
		maxRuntimeMs: effectiveMaxRuntimeMs,
	});
	orchestrator.setupIterationCallbacks();
}
