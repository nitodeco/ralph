import { create } from "zustand";
import { performSessionArchive } from "@/lib/archive.ts";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { ErrorCode, createError, getErrorSuggestion } from "@/lib/errors.ts";
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

interface AppStoreAgentDependencies {
  reset: () => void;
  stop: () => void;
  getIsStreaming: () => boolean;
  getIsComplete: () => boolean;
}

interface AppStoreIterationDependencies {
  setTotal: (total: number) => void;
  setFullMode: (isFullMode: boolean) => void;
  setStartTime: (startTime: number) => void;
  start: () => void;
  startFromIteration: (iteration: number) => void;
  stop: () => void;
  reset: () => void;
  getCurrent: () => number;
  getTotal: () => number;
  getIsRunning: () => boolean;
  markIterationComplete: (isProjectComplete: boolean, hasPendingTasks?: boolean) => void;
  restartCurrentIteration: () => void;
  setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => void;
}

interface AppStoreDependencies {
  agent: AppStoreAgentDependencies;
  iteration: AppStoreIterationDependencies;
}

let appStoreDependencies: AppStoreDependencies | null = null;

export function setAppStoreDependencies(dependencies: AppStoreDependencies): void {
  appStoreDependencies = dependencies;
}

function getAppStoreDependencies(): AppStoreDependencies {
  if (!appStoreDependencies) {
    throw new Error("AppStore dependencies not initialized. Call setAppStoreDependencies first.");
  }

  return appStoreDependencies;
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
      hint: "Run 'ralph init' or type /init to create one",
      message: "No prd.json found for this project",
    };
  }

  return null;
}

export const useAppStore = create<AppStore>((set, get) => ({
  activeView: "run",
  appState: "idle",
  clearManualNextTask: () => {
    set({ manualNextTask: null });
  },
  clearSession: () => {
    getAppStoreDependencies().iteration.reset();
    set({
      appState: "idle",
      currentSession: null,
      pendingSession: null,
    });
  },
  config: null,
  currentSession: null,
  dismissUpdateBanner: () => {
    set({ updateBannerDismissed: true });
  },
  elapsedTime: 0,
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
  handleAgentComplete: () => {
    const state = get();
    const deps = getAppStoreDependencies();
    const hasPendingTasks = state.prd ? state.prd.tasks.some((task) => !task.done) : false;

    deps.iteration.markIterationComplete(deps.agent.getIsComplete(), hasPendingTasks);
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
  incrementElapsedTime: () => {
    set((state) => ({ elapsedTime: state.elapsedTime + 1 }));
  },
  isInGitRepository: true,
  isReviewingTechnicalDebt: false,
  isVerifying: false,
  iterations: DEFAULTS.iterations,
  lastDecomposition: null,
  lastTechnicalDebtReport: null,
  lastVerificationResult: null,
  latestVersion: null,

  loadInitialState: (autoResume: boolean) => {
    migrateLocalRalphDir();

    const warning = validateProject();

    if (warning) {
      set({
        appState: "not_initialized",
        validationWarning: warning,
      });

      return;
    }

    const loadedConfig = getConfigService().get();
    const loadedPrd = getPrdService().get();
    const isInGitRepo = isGitRepository();

    set({
      config: loadedConfig,
      isInGitRepository: isInGitRepo,
      prd: loadedPrd,
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

  manualNextTask: null,

  maxRuntimeMs: null,

  pendingSession: null,

  prd: null,

  refreshState: (): RefreshStateResult => {
    const prdService = getPrdService();

    prdService.invalidate();

    try {
      const loadedPrd = prdService.get();

      if (!loadedPrd) {
        return {
          currentTaskIndex: -1,
          error: "Failed to load PRD file",
          success: false,
          taskCount: 0,
        };
      }

      set({ prd: loadedPrd });

      const currentTaskIndex = loadedPrd.tasks.findIndex((task) => !task.done);
      const taskCount = loadedPrd.tasks.length;

      return {
        currentTaskIndex,
        success: true,
        taskCount,
      };
    } catch (error) {
      return {
        currentTaskIndex: -1,
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
        taskCount: 0,
      };
    }
  },

  resetElapsedTime: () => {
    set({ elapsedTime: 0 });
  },

  resumeSession: () => {
    const state = get();

    if (!state.pendingSession) {
      return;
    }

    const warning = validateProject();

    if (warning) {
      set({
        appState: "not_initialized",
        validationWarning: warning,
      });

      return;
    }

    performSessionArchive();

    const loadedConfig = getConfigService().get();
    const loadedPrd = getPrdService().get();
    const isInGitRepo = isGitRepository();

    set({
      config: loadedConfig,
      isInGitRepository: isInGitRepo,
      prd: loadedPrd,
      validationWarning: null,
    });

    const { session: resumedSession } = getOrchestrator().resumeSession(
      state.pendingSession,
      loadedPrd,
    );

    const iterationDeps = getAppStoreDependencies().iteration;
    const resumeFromIteration = state.pendingSession.currentIteration + 1;

    iterationDeps.setTotal(state.pendingSession.totalIterations);

    const elapsedMs = state.pendingSession.elapsedTimeSeconds * 1000;

    iterationDeps.setStartTime(Date.now() - elapsedMs);

    set({
      currentSession: resumedSession,
      pendingSession: null,
    });

    set({
      appState: "running",
      elapsedTime: state.pendingSession.elapsedTimeSeconds,
    });

    getAppStoreDependencies().agent.reset();
    iterationDeps.startFromIteration(resumeFromIteration);
  },

  revalidateAndGoIdle: () => {
    getConfigService().invalidateAll();
    getPrdService().invalidate();

    const warning = validateProject();

    if (warning) {
      set({
        appState: "not_initialized",
        validationWarning: warning,
      });

      return;
    }

    const loadedConfig = getConfigService().get();
    const loadedPrd = getPrdService().get();
    const isInGitRepo = isGitRepository();

    set({
      appState: "idle",
      config: loadedConfig,
      elapsedTime: 0,
      isInGitRepository: isInGitRepo,
      prd: loadedPrd,
      validationWarning: null,
    });

    getAppStoreDependencies().agent.reset();
  },

  setActiveView: (activeView: ActiveView) => {
    set({ activeView });
  },

  setAppState: (appState: AppState) => {
    set({ appState });
  },

  setIterations: (iterations: number) => {
    set({ iterations });
  },

  setManualNextTask: (taskIdentifier: string): SetManualTaskResult => {
    const state = get();
    const prdService = getPrdService();
    const prd = state.prd ?? prdService.get();

    if (!prd) {
      const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD loaded");

      return {
        error: error.suggestion ? `${error.message}. ${error.suggestion}` : error.message,
        success: false,
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
        error: `Task not found: "${taskIdentifier}"\n\nAvailable tasks:\n${availableTasks}\n\n${suggestion}`,
        success: false,
      };
    }

    const canWork = prdService.canWorkOnTask(task);

    if (!canWork.canWork) {
      return {
        error: canWork.reason ?? "Cannot work on this task",
        success: false,
      };
    }

    set({ manualNextTask: task.title });

    return { success: true, taskTitle: task.title };
  },

  setMaxRuntimeMs: (maxRuntimeMs: number | null) => {
    set({ maxRuntimeMs });
  },

  setPrd: (prd: Prd | null) => {
    set({ prd });
  },

  setUpdateStatus: (updateAvailable: boolean, latestVersion: string | null) => {
    set({ latestVersion, updateAvailable });
  },

  singleTaskMode: false,

  startIterations: (iterationCount?: number, full?: boolean) => {
    const state = get();
    const warning = validateProject();

    if (warning) {
      set({
        appState: "not_initialized",
        validationWarning: warning,
      });

      return;
    }

    performSessionArchive();

    const loadedConfig = getConfigService().get();
    const loadedPrd = getPrdService().get();
    const isInGitRepo = isGitRepository();

    set({
      config: loadedConfig,
      isInGitRepository: isInGitRepo,
      prd: loadedPrd,
      validationWarning: null,
    });

    getSessionService().delete();
    set({ pendingSession: null });

    let totalIters = iterationCount || state.iterations || DEFAULTS.iterations;

    if (full && loadedPrd) {
      const incompleteTasks = loadedPrd.tasks.filter((task) => !task.done).length;

      totalIters = incompleteTasks > 0 ? incompleteTasks : 1;
    }

    const iterationDeps = getAppStoreDependencies().iteration;

    iterationDeps.setTotal(totalIters);
    iterationDeps.setFullMode(full === true);
    iterationDeps.setStartTime(Date.now());

    const { session: newSession } = getOrchestrator().startSession(loadedPrd, totalIters);

    set({ currentSession: newSession });

    set({
      appState: "running",
      elapsedTime: 0,
    });

    getAppStoreDependencies().agent.reset();
    iterationDeps.start();
  },

  startSingleTask: (taskIdentifier: string): SetManualTaskResult => {
    const warning = validateProject();

    if (warning) {
      set({
        appState: "not_initialized",
        validationWarning: warning,
      });

      return { error: warning.message, success: false };
    }

    performSessionArchive();

    const prdService = getPrdService();
    const loadedConfig = getConfigService().get();
    const loadedPrd = prdService.get();
    const isInGitRepo = isGitRepository();

    if (!loadedPrd) {
      const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD loaded");

      return {
        error: error.suggestion ? `${error.message}. ${error.suggestion}` : error.message,
        success: false,
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
        error: `Task not found: "${taskIdentifier}"\n\nAvailable pending tasks:\n${availableTasks}`,
        success: false,
      };
    }

    const canWork = prdService.canWorkOnTask(task);

    if (!canWork.canWork) {
      return { error: canWork.reason, success: false };
    }

    set({
      config: loadedConfig,
      isInGitRepository: isInGitRepo,
      manualNextTask: task.title,
      prd: loadedPrd,
      singleTaskMode: true,
      validationWarning: null,
    });

    getSessionService().delete();
    set({ pendingSession: null });

    const iterationDeps = getAppStoreDependencies().iteration;

    iterationDeps.setTotal(1);
    iterationDeps.setStartTime(Date.now());

    const { session: newSession } = getOrchestrator().startSession(loadedPrd, 1);

    set({ currentSession: newSession });

    set({
      appState: "running",
      elapsedTime: 0,
    });

    getAppStoreDependencies().agent.reset();
    iterationDeps.start();

    return { success: true, taskTitle: task.title };
  },

  stopAgent: () => {
    const deps = getAppStoreDependencies();
    const state = get();

    if (deps.agent.getIsStreaming() || deps.iteration.getIsRunning()) {
      deps.agent.stop();
      deps.iteration.stop();

      if (state.currentSession) {
        const sessionService = getSessionService();
        const stoppedSession = sessionService.updateStatus(state.currentSession, "stopped");

        sessionService.save(stoppedSession);
        set({ currentSession: stoppedSession });
      }

      const loadedConfig = getConfigService().get();

      sendNotifications(loadedConfig.notifications, "session_paused", state.prd?.project, {
        iteration: deps.iteration.getCurrent(),
        totalIterations: deps.iteration.getTotal(),
      });

      set({ appState: "idle" });
    }
  },

  updateAvailable: false,

  updateBannerDismissed: false,

  validationWarning: null,
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
  const iterationDeps = getAppStoreDependencies().iteration;

  orchestrator.initialize(
    {
      config: loadedConfig,
      iterations,
      maxRuntimeMs: effectiveMaxRuntimeMs,
      skipVerification,
    },
    {
      onAppStateChange: (state) => {
        useAppStore.setState({ appState: state });
      },
      onFatalError: (error, prd, currentSession) => {
        const stoppedSession = orchestrator.handleFatalError(error, prd, currentSession);

        if (stoppedSession) {
          useAppStore.setState({ currentSession: stoppedSession });
        }

        useAppStore.setState({ appState: "error" });
      },
      onIterationComplete: (allTasksDone, hasPendingTasks) => {
        iterationDeps.markIterationComplete(allTasksDone, hasPendingTasks);
      },
      onPrdUpdate: (prd) => {
        useAppStore.setState({ prd });
      },
      onRestartIteration: () => {
        iterationDeps.restartCurrentIteration();
      },
      onVerificationStateChange: (isVerifying, result) => {
        useAppStore.setState({ isVerifying, lastVerificationResult: result });
      },
      setMaxRuntimeMs: (runtimeMs) => {
        iterationDeps.setMaxRuntimeMs(runtimeMs);
      },
    },
  );
  orchestrator.setupIterationCallbacks();

  if (orchestrator.isBranchModeEnabled()) {
    const branchInitResult = orchestrator.initializeBranchMode();

    if (!branchInitResult.isValid) {
      return {
        branchModeEnabled: true,
        error: branchInitResult.error,
        success: false,
      };
    }
  }

  return { branchModeEnabled: orchestrator.isBranchModeEnabled(), success: true };
}
