import { create } from "zustand";
import { performSessionArchive } from "@/lib/archive.ts";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { createError, ErrorCode, getErrorSuggestion } from "@/lib/errors.ts";
import { eventBus } from "@/lib/events.ts";
import type { TechnicalDebtReport } from "@/lib/handlers/index.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { isGitRepository } from "@/lib/paths.ts";
import {
	getConfigService,
	getOrchestrator,
	getPrdService,
	getProjectRegistryService,
	getSessionService,
} from "@/lib/services/index.ts";
import { migrateLocalRalphDir } from "@/lib/services/project-registry/index.ts";
import type {
	ActiveView,
	AppState,
	DecompositionRequest,
	Prd,
	PrdTask,
	RalphConfig,
	Session,
	SetManualTaskResult,
	ValidationWarning,
	VerificationResult,
} from "@/types.ts";
import { useAgentStore } from "./agentStore.ts";
import { useIterationStore } from "./iterationStore.ts";

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
	isVerifying: boolean;
	lastVerificationResult: VerificationResult | null;
	lastDecomposition: DecompositionRequest | null;
	isReviewingTechnicalDebt: boolean;
	lastTechnicalDebtReport: TechnicalDebtReport | null;
	updateAvailable: boolean;
	latestVersion: string | null;
	updateBannerDismissed: boolean;
	isInGitRepository: boolean;
}

interface RefreshStateResult {
	success: boolean;
	taskCount: number;
	currentTaskIndex: number;
	error?: string;
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
	setUpdateStatus: (updateAvailable: boolean, latestVersion: string | null) => void;
	dismissUpdateBanner: () => void;
	refreshState: () => RefreshStateResult;
	clearSession: () => void;
}

type AppStore = AppStoreState & AppStoreActions;

function validateProject(): ValidationWarning | null {
	const projectRegistryService = getProjectRegistryService();
	const isInitialized = projectRegistryService.isProjectInitialized();

	if (!isInitialized) {
		return {
			message: "No prd.json found for this project",
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
	isVerifying: false,
	lastVerificationResult: null,
	lastDecomposition: null,
	isReviewingTechnicalDebt: false,
	lastTechnicalDebtReport: null,
	updateAvailable: false,
	latestVersion: null,
	updateBannerDismissed: false,
	isInGitRepository: true,

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
		migrateLocalRalphDir();

		const warning = validateProject();

		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});

			return;
		}

		const loadedConfig = getConfigService().get();
		const loadedPrd = getPrdService().get();
		const isInGitRepo = isGitRepository();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			isInGitRepository: isInGitRepo,
		});

		const sessionService = getSessionService();
		const existingSession = sessionService.load();

		if (sessionService.isResumable(existingSession)) {
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

		const loadedConfig = getConfigService().get();
		const loadedPrd = getPrdService().get();
		const isInGitRepo = isGitRepository();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			isInGitRepository: isInGitRepo,
		});

		getSessionService().delete();
		set({ pendingSession: null });

		let totalIters = iterationCount || state.iterations || DEFAULTS.iterations;

		if (full && loadedPrd) {
			const incompleteTasks = loadedPrd.tasks.filter((task) => !task.done).length;

			totalIters = incompleteTasks > 0 ? incompleteTasks : 1;
		}

		const iterationStore = useIterationStore.getState();

		iterationStore.setTotal(totalIters);
		iterationStore.setFullMode(full === true);
		iterationStore.setStartTime(Date.now());

		const { session: newSession } = getOrchestrator().startSession(loadedPrd, totalIters);

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

		const prdService = getPrdService();
		const loadedConfig = getConfigService().get();
		const loadedPrd = prdService.get();
		const isInGitRepo = isGitRepository();

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
			task = prdService.getTaskByIndex(loadedPrd, taskIndex - 1);
		} else {
			task = prdService.getTaskByTitle(loadedPrd, taskIdentifier);
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

		const canWork = prdService.canWorkOnTask(task);

		if (!canWork.canWork) {
			return { success: false, error: canWork.reason };
		}

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			manualNextTask: task.title,
			singleTaskMode: true,
			isInGitRepository: isInGitRepo,
		});

		getSessionService().delete();
		set({ pendingSession: null });

		const iterationStore = useIterationStore.getState();

		iterationStore.setTotal(1);
		iterationStore.setStartTime(Date.now());

		const { session: newSession } = getOrchestrator().startSession(loadedPrd, 1);

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

		const loadedConfig = getConfigService().get();
		const loadedPrd = getPrdService().get();
		const isInGitRepo = isGitRepository();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			isInGitRepository: isInGitRepo,
		});

		const { session: resumedSession } = getOrchestrator().resumeSession(
			state.pendingSession,
			loadedPrd,
		);

		const iterationStore = useIterationStore.getState();
		const resumeFromIteration = state.pendingSession.currentIteration + 1;

		iterationStore.setTotal(state.pendingSession.totalIterations);

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
		iterationStore.startFromIteration(resumeFromIteration);
	},

	stopAgent: () => {
		const agentStore = useAgentStore.getState();
		const iterationStore = useIterationStore.getState();
		const state = get();

		if (agentStore.isStreaming || iterationStore.isRunning) {
			agentStore.stop();
			iterationStore.stop();

			if (state.currentSession) {
				const sessionService = getSessionService();
				const stoppedSession = sessionService.updateStatus(state.currentSession, "stopped");

				sessionService.save(stoppedSession);
				set({ currentSession: stoppedSession });
			}

			const loadedConfig = getConfigService().get();

			sendNotifications(loadedConfig.notifications, "session_paused", state.prd?.project, {
				iteration: iterationStore.current,
				totalIterations: iterationStore.total,
			});

			eventBus.emit("session:stop", { reason: "user_stop" });
			set({ appState: "idle" });
		}
	},

	revalidateAndGoIdle: () => {
		getConfigService().invalidateAll();
		getPrdService().invalidate();

		const warning = validateProject();

		if (warning) {
			set({
				validationWarning: warning,
				appState: "not_initialized",
			});

			return;
		}

		const loadedConfig = getConfigService().get();
		const loadedPrd = getPrdService().get();
		const isInGitRepo = isGitRepository();

		set({
			config: loadedConfig,
			prd: loadedPrd,
			validationWarning: null,
			appState: "idle",
			elapsedTime: 0,
			isInGitRepository: isInGitRepo,
		});

		useAgentStore.getState().reset();
	},

	handleAgentComplete: () => {
		const state = get();
		const agentStore = useAgentStore.getState();
		const iterationStore = useIterationStore.getState();
		const hasPendingTasks = state.prd ? state.prd.tasks.some((task) => !task.done) : false;

		iterationStore.markIterationComplete(agentStore.isComplete, hasPendingTasks);
	},

	handleFatalError: (error: string) => {
		const state = get();
		const stoppedSession = getOrchestrator().handleFatalError(
			error,
			state.prd,
			state.currentSession,
		);

		if (stoppedSession) {
			set({ currentSession: stoppedSession });
		}

		set({ appState: "error" });
	},

	setManualNextTask: (taskIdentifier: string): SetManualTaskResult => {
		const state = get();
		const prdService = getPrdService();
		const prd = state.prd ?? prdService.get();

		if (!prd) {
			const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD loaded");

			return {
				success: false,
				error: error.suggestion ? `${error.message}. ${error.suggestion}` : error.message,
			};
		}

		const taskIndex = Number.parseInt(taskIdentifier, 10);
		const task = Number.isNaN(taskIndex)
			? prdService.getTaskByTitle(prd, taskIdentifier)
			: prdService.getTaskByIndex(prd, taskIndex - 1);

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

		const canWork = prdService.canWorkOnTask(task);

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
		const prdService = getPrdService();

		if (state.manualNextTask) {
			const prd = state.prd ?? prdService.get();

			if (prd) {
				const task = prdService.getTaskByTitle(prd, state.manualNextTask);

				if (task && !task.done) {
					return state.manualNextTask;
				}
			}

			set({ manualNextTask: null });
		}

		const prd = state.prd ?? prdService.get();

		return prd ? prdService.getNextTask(prd) : null;
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

	setUpdateStatus: (updateAvailable: boolean, latestVersion: string | null) => {
		set({ updateAvailable, latestVersion });
	},

	dismissUpdateBanner: () => {
		set({ updateBannerDismissed: true });
	},

	refreshState: (): RefreshStateResult => {
		const prdService = getPrdService();

		prdService.invalidate();

		try {
			const loadedPrd = prdService.get();

			if (!loadedPrd) {
				return {
					success: false,
					taskCount: 0,
					currentTaskIndex: -1,
					error: "Failed to load PRD file",
				};
			}

			set({ prd: loadedPrd });

			const currentTaskIndex = loadedPrd.tasks.findIndex((task) => !task.done);
			const taskCount = loadedPrd.tasks.length;

			return {
				success: true,
				taskCount,
				currentTaskIndex,
			};
		} catch (error) {
			return {
				success: false,
				taskCount: 0,
				currentTaskIndex: -1,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},

	clearSession: () => {
		useIterationStore.getState().reset();
		set({
			pendingSession: null,
			currentSession: null,
			appState: "idle",
		});
	},
}));

export interface SetupIterationCallbacksResult {
	success: boolean;
	error?: string;
	branchModeEnabled?: boolean;
}

export function setupIterationCallbacks(
	iterations: number,
	maxRuntimeMs?: number,
	skipVerification?: boolean,
): SetupIterationCallbacksResult {
	const loadedConfig = getConfigService().get();
	const effectiveMaxRuntimeMs = maxRuntimeMs ?? loadedConfig.maxRuntimeMs;
	const orchestrator = getOrchestrator();

	orchestrator.initialize(
		{
			config: loadedConfig,
			iterations,
			maxRuntimeMs: effectiveMaxRuntimeMs,
			skipVerification,
		},
		{
			onPrdUpdate: (prd) => {
				useAppStore.setState({ prd });
			},
			onRestartIteration: () => {
				useIterationStore.getState().restartCurrentIteration();
			},
			onVerificationStateChange: (isVerifying, result) => {
				useAppStore.setState({ isVerifying, lastVerificationResult: result });
			},
			onIterationComplete: (allTasksDone, hasPendingTasks) => {
				const iterationStore = useIterationStore.getState();

				iterationStore.markIterationComplete(allTasksDone, hasPendingTasks);
			},
			onFatalError: (error, prd, currentSession) => {
				const stoppedSession = orchestrator.handleFatalError(error, prd, currentSession);

				if (stoppedSession) {
					useAppStore.setState({ currentSession: stoppedSession });
				}

				useAppStore.setState({ appState: "error" });
			},
			onAppStateChange: (state) => {
				useAppStore.setState({ appState: state });
			},
			setMaxRuntimeMs: (runtimeMs) => {
				useIterationStore.getState().setMaxRuntimeMs(runtimeMs);
			},
		},
	);
	orchestrator.setupIterationCallbacks();

	if (orchestrator.isBranchModeEnabled()) {
		const branchInitResult = orchestrator.initializeBranchMode();

		if (!branchInitResult.isValid) {
			return {
				success: false,
				error: branchInitResult.error,
				branchModeEnabled: true,
			};
		}
	}

	return { success: true, branchModeEnabled: orchestrator.isBranchModeEnabled() };
}
