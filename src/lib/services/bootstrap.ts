import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBranchModeManager } from "./branch-mode-manager/implementation.ts";
import type { BranchModeManager } from "./branch-mode-manager/types.ts";
import { createConfigService } from "./config/implementation.ts";
import type { ConfigService } from "./config/types.ts";
import { type ServiceContainer, initializeServices, resetServices } from "./container.ts";
import { createGitBranchService } from "./git-branch/implementation.ts";
import type { GitBranchService } from "./git-branch/types.ts";
import { createGitHubProvider } from "./git-provider/github-provider.ts";
import { createGitProviderService, registerProvider } from "./git-provider/implementation.ts";
import type { GitProviderService } from "./git-provider/types.ts";
import { createGuardrailsService } from "./guardrails/implementation.ts";
import type { GuardrailsService } from "./guardrails/types.ts";
import { createHandlerCoordinator } from "./handler-coordinator/implementation.ts";
import type { HandlerCoordinator } from "./handler-coordinator/types.ts";
import { createIterationCoordinator } from "./iteration-coordinator/implementation.ts";
import type { IterationCoordinator } from "./iteration-coordinator/types.ts";
import { type MemoryMonitorService, createMemoryMonitorService } from "./MemoryMonitorService.ts";
import { createOrchestrator } from "./orchestrator/implementation.ts";
import type { Orchestrator } from "./orchestrator/types.ts";
import { createParallelExecutionManager } from "./parallel-execution-manager/implementation.ts";
import type { ParallelExecutionManager } from "./parallel-execution-manager/types.ts";
import { createPrdService } from "./prd/implementation.ts";
import type { PrdService } from "./prd/types.ts";
import { createProjectRegistryService } from "./project-registry/implementation.ts";
import type {
  ProjectIdentifier,
  ProjectRegistry,
  ProjectRegistryService,
} from "./project-registry/types.ts";
import {
  type SleepPreventionService,
  createSleepPreventionService,
} from "./SleepPreventionService.ts";
import { createSessionService } from "./session/implementation.ts";
import type { SessionService } from "./session/types.ts";
import { createSessionManager } from "./session-manager/implementation.ts";
import type { SessionManager } from "./session-manager/types.ts";
import { createSessionMemoryService } from "./session-memory/implementation.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";
import { createUsageStatisticsService } from "./usage-statistics/implementation.ts";
import type { UsageStatisticsService } from "./usage-statistics/types.ts";

export interface SessionManagerStoreDependencies {
  getAgentStoreState: () => {
    exitCode: number | null;
    retryCount: number;
    output: string;
  };
  getIterationStoreState: () => {
    current: number;
  };
}

export interface IterationCoordinatorStoreDependencies {
  getAppStoreState: () => {
    prd: import("./prd/types.ts").Prd | null;
    currentSession: import("./session/types.ts").Session | null;
    elapsedTime: number;
    manualNextTask: string | null;
    isVerifying: boolean;
    isReviewingTechnicalDebt: boolean;
    lastVerificationResult: import("@/types.ts").VerificationResult | null;
    lastTechnicalDebtReport:
      | import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
      | null;
    lastDecomposition: import("@/types.ts").DecompositionRequest | null;
    getEffectiveNextTask: () => string | null;
    clearManualNextTask: () => void;
    setPrd: (prd: import("./prd/types.ts").Prd) => void;
  };
  setAppStoreState: (
    state: Partial<{
      prd: import("./prd/types.ts").Prd | null;
      currentSession: import("./session/types.ts").Session | null;
      isVerifying: boolean;
      isReviewingTechnicalDebt: boolean;
      lastVerificationResult: import("@/types.ts").VerificationResult | null;
      lastTechnicalDebtReport:
        | import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
        | null;
      lastDecomposition: import("@/types.ts").DecompositionRequest | null;
      appState: import("@/types.ts").AppState;
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
    prd: import("./prd/types.ts").Prd | null,
  ) => Promise<{ success: boolean; error?: string; prUrl?: string }>;
}

export interface ParallelExecutionManagerStoreDependencies {
  getAppStoreState: () => {
    prd: import("./prd/types.ts").Prd | null;
    currentSession: import("./session/types.ts").Session | null;
  };
  setAppStoreState: (
    state: Partial<{
      currentSession: import("./session/types.ts").Session | null;
    }>,
  ) => void;
}

let sessionManagerDependencies: SessionManagerStoreDependencies | null = null;
let iterationCoordinatorDependencies: IterationCoordinatorStoreDependencies | null = null;
let parallelExecutionManagerDependencies: ParallelExecutionManagerStoreDependencies | null = null;

export function setSessionManagerDependencies(dependencies: SessionManagerStoreDependencies): void {
  sessionManagerDependencies = dependencies;
}

export function setIterationCoordinatorDependencies(
  dependencies: IterationCoordinatorStoreDependencies,
): void {
  iterationCoordinatorDependencies = dependencies;
}

export function setParallelExecutionManagerDependencies(
  dependencies: ParallelExecutionManagerStoreDependencies,
): void {
  parallelExecutionManagerDependencies = dependencies;
}

export function bootstrapServices(): void {
  registerProvider("github", createGitHubProvider);

  const sessionManagerDeps: SessionManagerStoreDependencies = {
    getAgentStoreState: () => {
      if (!sessionManagerDependencies) {
        return { exitCode: null, output: "", retryCount: 0 };
      }

      return sessionManagerDependencies.getAgentStoreState();
    },
    getIterationStoreState: () => {
      if (!sessionManagerDependencies) {
        return { current: 0 };
      }

      return sessionManagerDependencies.getIterationStoreState();
    },
  };

  const iterationCoordinatorDeps: IterationCoordinatorStoreDependencies = {
    completeTaskBranch: async (prd) => {
      if (!iterationCoordinatorDependencies) {
        return { success: true };
      }

      return iterationCoordinatorDependencies.completeTaskBranch(prd);
    },
    createTaskBranch: (taskTitle, taskIndex) => {
      if (!iterationCoordinatorDependencies) {
        return { success: true };
      }

      return iterationCoordinatorDependencies.createTaskBranch(taskTitle, taskIndex);
    },
    getAgentStoreState: () => {
      if (!iterationCoordinatorDependencies) {
        return {
          error: null,
          exitCode: null,
          isComplete: false,
          output: "",
          reset: () => {},
          retryCount: 0,
        };
      }

      return iterationCoordinatorDependencies.getAgentStoreState();
    },
    getAppStoreState: () => {
      if (!iterationCoordinatorDependencies) {
        return {
          clearManualNextTask: () => {},
          currentSession: null,
          elapsedTime: 0,
          getEffectiveNextTask: () => null,
          isReviewingTechnicalDebt: false,
          isVerifying: false,
          lastDecomposition: null,
          lastTechnicalDebtReport: null,
          lastVerificationResult: null,
          manualNextTask: null,
          prd: null,
          setPrd: () => {},
        };
      }

      return iterationCoordinatorDependencies.getAppStoreState();
    },
    getIterationStoreState: () => {
      if (!iterationCoordinatorDependencies) {
        return {
          current: 0,
          restartCurrentIteration: () => {},
          setCallbacks: () => {},
          total: 0,
        };
      }

      return iterationCoordinatorDependencies.getIterationStoreState();
    },
    resetAgent: () => {
      if (iterationCoordinatorDependencies) {
        iterationCoordinatorDependencies.resetAgent();
      }
    },
    setAppStoreState: (state) => {
      if (iterationCoordinatorDependencies) {
        iterationCoordinatorDependencies.setAppStoreState(state);
      }
    },
    startAgent: (specificTask) => {
      if (iterationCoordinatorDependencies) {
        iterationCoordinatorDependencies.startAgent(specificTask);
      }
    },
    stopAgent: () => {
      if (iterationCoordinatorDependencies) {
        iterationCoordinatorDependencies.stopAgent();
      }
    },
  };

  const parallelExecutionManagerDeps: ParallelExecutionManagerStoreDependencies = {
    getAppStoreState: () => {
      if (!parallelExecutionManagerDependencies) {
        return {
          currentSession: null,
          prd: null,
        };
      }

      return parallelExecutionManagerDependencies.getAppStoreState();
    },
    setAppStoreState: (state) => {
      if (parallelExecutionManagerDependencies) {
        parallelExecutionManagerDependencies.setAppStoreState(state);
      }
    },
  };

  initializeServices({
    branchModeManager: createBranchModeManager(),
    config: createConfigService(),
    gitBranch: createGitBranchService(),
    gitProvider: createGitProviderService(),
    guardrails: createGuardrailsService(),
    handlerCoordinator: createHandlerCoordinator(),
    iterationCoordinator: createIterationCoordinator(iterationCoordinatorDeps),
    memoryMonitor: createMemoryMonitorService(),
    orchestrator: createOrchestrator(),
    parallelExecutionManager: createParallelExecutionManager(parallelExecutionManagerDeps),
    prd: createPrdService(),
    projectRegistry: createProjectRegistryService(),
    session: createSessionService(),
    sessionManager: createSessionManager(sessionManagerDeps),
    sessionMemory: createSessionMemoryService(),
    sleepPrevention: createSleepPreventionService(),
    usageStatistics: createUsageStatisticsService(),
  });
}

export interface TestServiceOverrides {
  projectRegistry?: Partial<ProjectRegistryService>;
  config?: Partial<ConfigService>;
  guardrails?: Partial<GuardrailsService>;
  prd?: Partial<PrdService>;
  sessionMemory?: Partial<SessionMemoryService>;
  session?: Partial<SessionService>;
  sessionManager?: Partial<SessionManager>;
  iterationCoordinator?: Partial<IterationCoordinator>;
  parallelExecutionManager?: Partial<ParallelExecutionManager>;
  branchModeManager?: Partial<BranchModeManager>;
  handlerCoordinator?: Partial<HandlerCoordinator>;
  orchestrator?: Partial<Orchestrator>;
  sleepPrevention?: Partial<SleepPreventionService>;
  memoryMonitor?: Partial<MemoryMonitorService>;
  usageStatistics?: Partial<UsageStatisticsService>;
  gitBranch?: Partial<GitBranchService>;
  gitProvider?: Partial<GitProviderService>;
}

function createMockProjectRegistryService(
  overrides: Partial<ProjectRegistryService> = {},
): ProjectRegistryService {
  const testIdentifier: ProjectIdentifier = {
    folderName: "path--test-project",
    type: "path",
    value: "/tmp/test-project",
  };

  const emptyRegistry: ProjectRegistry = {
    pathCache: {},
    projects: {},
    version: 1,
  };

  const currentWorkingDir = process.cwd();
  const isInTempDir =
    currentWorkingDir.startsWith(tmpdir()) || currentWorkingDir.startsWith("/tmp");
  const projectStorageDir = isInTempDir
    ? join(currentWorkingDir, ".ralph")
    : join(tmpdir(), "ralph-mock");
  const baseMockDir = isInTempDir ? currentWorkingDir : join(tmpdir(), "ralph-mock");

  return {
    ensureProjectsDir: () => {},
    getProjectDir: () => projectStorageDir,
    getProjectFilePath: (relativePath: string) => `${projectStorageDir}/${relativePath}`,
    getProjectMetadata: () => null,
    getProjectsDir: () => join(baseMockDir, "projects"),
    getRegistryPath: () => join(baseMockDir, "registry.json"),
    isProjectInitialized: () => true,
    listProjects: () => [],
    loadRegistry: () => emptyRegistry,
    registerProject: () => testIdentifier,
    removeProject: () => true,
    resolveCurrentProject: () => testIdentifier,
    saveRegistry: () => {},
    updateLastAccessed: () => {},
    ...overrides,
  };
}

function createMockConfigService(overrides: Partial<ConfigService> = {}): ConfigService {
  const defaultConfig = {
    agent: "cursor" as const,
    agentTimeoutMs: 300_000,
    learningEnabled: true,
    maxDecompositionsPerTask: 3,
    maxOutputHistoryBytes: 1_048_576,
    maxRetries: 3,
    retryDelayMs: 1000,
    retryWithContext: true,
    stuckThresholdMs: 60_000,
    verification: {
      enabled: false,
      failOnWarning: false,
    },
  };

  return {
    acknowledgeWarning: () => {},
    get: () => defaultConfig,
    getEffective: () => ({
      effective: defaultConfig,
      global: null,
      project: null,
    }),
    getWithValidation: (validateFn) => ({
      config: defaultConfig,
      validation: validateFn(defaultConfig),
    }),
    globalConfigExists: () => true,
    hasAcknowledgedWarning: () => true,
    invalidate: () => {},
    invalidateAll: () => {},
    invalidateGlobal: () => {},
    load: () => defaultConfig,
    loadGlobal: () => defaultConfig,
    loadGlobalRaw: () => null,
    loadProjectRaw: () => null,
    saveGlobal: () => {},
    saveProject: () => {},
    ...overrides,
  };
}

function createMockPrdService(overrides: Partial<PrdService> = {}): PrdService {
  return {
    canWorkOnTask: () => ({ canWork: true }),
    createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
    deleteTask: (prd) => prd,
    findFile: () => null,
    get: () => null,
    getCurrentTaskIndex: () => -1,
    getNextTask: () => null,
    getNextTaskWithIndex: () => null,
    getTaskByIndex: () => null,
    getTaskByTitle: () => null,
    invalidate: () => {},
    isComplete: () => false,
    load: () => null,
    loadInstructions: () => null,
    loadWithValidation: () => ({ prd: null }),
    reload: () => null,
    reloadWithValidation: () => ({ prd: null }),
    reorderTask: (prd) => prd,
    save: () => {},
    toggleTaskDone: (prd) => prd,
    updateTask: (prd) => prd,
    ...overrides,
  };
}

function createMockSessionMemoryService(
  overrides: Partial<SessionMemoryService> = {},
): SessionMemoryService {
  const emptyMemory = {
    failedApproaches: [],
    lastUpdated: new Date().toISOString(),
    lessonsLearned: [],
    projectName: "Test Project",
    successfulPatterns: [],
    taskNotes: {},
  };

  return {
    addFailedApproach: () => {},
    addLesson: () => {},
    addSuccessPattern: () => {},
    addTaskNote: () => {},
    clear: () => {},
    exists: () => false,
    exportAsMarkdown: () => "",
    formatForPrompt: () => "",
    formatForTask: () => "",
    get: () => emptyMemory,
    getStats: () => ({
      failedApproachesCount: 0,
      lastUpdated: null,
      lessonsCount: 0,
      patternsCount: 0,
      taskNotesCount: 0,
    }),
    getTaskNote: () => null,
    initialize: () => emptyMemory,
    invalidate: () => {},
    load: () => emptyMemory,
    save: () => {},
    ...overrides,
  };
}

function createMockSessionService(overrides: Partial<SessionService> = {}): SessionService {
  const createMockSession = (totalIterations: number, currentTaskIndex: number) => ({
    currentIteration: 0,
    currentTaskIndex,
    elapsedTimeSeconds: 0,
    lastUpdateTime: Date.now(),
    startTime: Date.now(),
    statistics: {
      averageDurationMs: 0,
      completedIterations: 0,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations,
    },
    status: "running" as const,
    totalIterations,
  });

  return {
    completeParallelGroup: (session) => session,
    completeTaskExecution: (session) => session,
    create: createMockSession,
    delete: () => {},
    disableParallelMode: (session) => {
      const { parallelState: _, ...rest } = session;

      return { ...rest, lastUpdateTime: Date.now() };
    },
    enableParallelMode: (session, maxConcurrentTasks) => ({
      ...session,
      lastUpdateTime: Date.now(),
      parallelState: {
        activeExecutions: [],
        currentGroupIndex: -1,
        executionGroups: [],
        isParallelMode: true,
        maxConcurrentTasks,
      },
    }),
    exists: () => false,
    failTaskExecution: (session) => session,
    getActiveExecutionCount: () => 0,
    getActiveExecutions: () => [],
    getCurrentParallelGroup: () => null,
    getTaskExecution: () => null,
    isParallelMode: (session) => session.parallelState?.isParallelMode ?? false,
    isResumable: () => false,
    isTaskExecuting: () => false,
    load: () => null,
    recordIterationEnd: (session) => ({ ...session, lastUpdateTime: Date.now() }),
    recordIterationStart: (session) => ({ ...session, lastUpdateTime: Date.now() }),
    retryTaskExecution: (session) => session,
    save: () => {},
    startParallelGroup: (session) => session,
    startTaskExecution: (session) => session,
    updateIteration: (session, currentIteration, currentTaskIndex, elapsedTimeSeconds) => ({
      ...session,
      currentIteration,
      currentTaskIndex,
      elapsedTimeSeconds,
      lastUpdateTime: Date.now(),
    }),
    updateStatus: (session, status) => ({ ...session, lastUpdateTime: Date.now(), status }),
    ...overrides,
  };
}

function createMockGuardrailsService(
  overrides: Partial<GuardrailsService> = {},
): GuardrailsService {
  const defaultGuardrails = [
    {
      addedAt: new Date().toISOString(),
      category: "quality" as const,
      enabled: true,
      id: "verify-before-commit",
      instruction: "Verify changes work before committing",
      trigger: "always" as const,
    },
  ];

  return {
    add: (options) => ({
      addedAfterFailure: options.addedAfterFailure,
      addedAt: new Date().toISOString(),
      category: options.category ?? "quality",
      enabled: options.enabled ?? true,
      id: `guardrail-${Date.now()}`,
      instruction: options.instruction,
      trigger: options.trigger ?? "always",
    }),
    exists: () => false,
    formatForPrompt: () => "",
    get: () => defaultGuardrails,
    getActive: () => defaultGuardrails,
    getById: () => null,
    initialize: () => {},
    invalidate: () => {},
    load: () => defaultGuardrails,
    remove: () => true,
    save: () => {},
    toggle: () => null,
    ...overrides,
  };
}

function createMockSleepPreventionService(
  overrides: Partial<SleepPreventionService> = {},
): SleepPreventionService {
  return {
    isActive: () => false,
    start: () => {},
    stop: () => {},
    ...overrides,
  };
}

function createMockMemoryMonitorService(
  overrides: Partial<MemoryMonitorService> = {},
): MemoryMonitorService {
  return {
    getMemoryUsageMb: () => 100,
    getThresholdMb: () => 1024,
    isActive: () => false,
    setThresholdMb: () => {},
    start: () => {},
    stop: () => {},
    ...overrides,
  };
}

function createMockUsageStatisticsService(
  overrides: Partial<UsageStatisticsService> = {},
): UsageStatisticsService {
  const emptyStatistics = {
    createdAt: new Date().toISOString(),
    dailyUsage: [],
    lastUpdatedAt: new Date().toISOString(),
    lifetime: {
      averageIterationsPerSession: 0,
      averageSessionDurationMs: 0,
      averageTasksPerSession: 0,
      failedIterations: 0,
      overallSuccessRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations: 0,
      totalSessions: 0,
      totalTasksAttempted: 0,
      totalTasksCompleted: 0,
    },
    projectName: "Test Project",
    recentSessions: [],
    version: 1,
  };

  return {
    exists: () => false,
    formatForDisplay: () => "",
    get: () => emptyStatistics,
    getDailyUsage: () => [],
    getRecentSessions: () => [],
    getSummary: () => ({
      averageIterationsPerSession: 0,
      averageSessionDurationMs: 0,
      lastSessionAt: null,
      overallSuccessRate: 0,
      streakDays: 0,
      totalDurationMs: 0,
      totalIterations: 0,
      totalSessions: 0,
      totalTasksCompleted: 0,
    }),
    initialize: () => emptyStatistics,
    invalidate: () => {},
    load: () => emptyStatistics,
    recordSession: () => {},
    save: () => {},
    ...overrides,
  };
}

function createMockGitBranchService(overrides: Partial<GitBranchService> = {}): GitBranchService {
  return {
    checkoutBranch: (branchName) => ({
      branchName,
      message: `Checked out branch: ${branchName}`,
      status: "success",
    }),
    commitChanges: () => ({
      message: "Changes committed successfully",
      status: "success",
    }),
    createAndCheckoutTaskBranch: (taskTitle, taskIndex) => {
      const branchName = `ralph/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`;

      return {
        branchName,
        message: `Created and checked out branch: ${branchName}`,
        status: "success",
      };
    },
    createBranch: (branchName) => ({
      branchName,
      message: `Created branch: ${branchName}`,
      status: "success",
    }),
    deleteBranch: (branchName) => ({
      branchName,
      message: `Deleted branch: ${branchName}`,
      status: "success",
    }),
    generateBranchName: (taskTitle, taskIndex, prefix = "ralph") =>
      `${prefix}/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`,
    getBaseBranch: () => "main",
    getBranchInfo: () => ({
      baseBranch: "main",
      currentBranch: "main",
      hasRemote: true,
      remoteName: "origin",
    }),
    getCurrentBranch: () => "main",
    getRemoteName: () => "origin",
    getRemoteUrl: () => "git@github.com:test-org/test-repo.git",
    getWorkingDirectoryStatus: () => ({
      hasUncommittedChanges: false,
      hasUntrackedFiles: false,
      isClean: true,
      modifiedFiles: [],
      untrackedFiles: [],
    }),
    hasRemote: () => true,
    isWorkingDirectoryClean: () => true,
    popStash: () => ({
      message: "Stash popped successfully",
      status: "success",
    }),
    pushBranch: (branchName) => ({
      branchName,
      message: `Pushed branch: ${branchName}`,
      status: "success",
    }),
    returnToBaseBranch: (baseBranch) => ({
      branchName: baseBranch,
      message: `Returned to branch: ${baseBranch}`,
      status: "success",
    }),
    stashChanges: () => ({
      message: "Changes stashed successfully",
      status: "success",
    }),
    ...overrides,
  };
}

function createMockGitProviderService(
  overrides: Partial<GitProviderService> = {},
): GitProviderService {
  return {
    detectProvider: (remoteUrl) => ({
      hostname: "github.com",
      owner: "test-owner",
      provider: remoteUrl.includes("github.com") ? "github" : "none",
      repo: "test-repo",
    }),
    getProvider: () => null,
    getProviderForRemote: () => null,
    getSupportedProviders: () => [],
    isProviderConfigured: () => false,
    ...overrides,
  };
}

function createMockSessionManager(overrides: Partial<SessionManager> = {}): SessionManager {
  const createMockSession = (totalIterations: number, currentTaskIndex: number) => ({
    currentIteration: 0,
    currentTaskIndex,
    elapsedTimeSeconds: 0,
    lastUpdateTime: Date.now(),
    startTime: Date.now(),
    statistics: {
      averageDurationMs: 0,
      completedIterations: 0,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations,
    },
    status: "running" as const,
    totalIterations,
  });

  return {
    handleFatalError: (_error, _prd, currentSession) => ({
      session: currentSession ? { ...currentSession, status: "stopped" as const } : null,
      wasHandled: true,
    }),
    recordUsageStatistics: () => {},
    resumeSession: (pendingSession) => ({
      remainingIterations: pendingSession.totalIterations - pendingSession.currentIteration,
      session: { ...pendingSession, status: "running" as const },
    }),
    setConfig: () => {},
    startSession: (_prd, totalIterations) => ({
      session: createMockSession(totalIterations, 0),
      taskIndex: 0,
    }),
    ...overrides,
  };
}

function createMockIterationCoordinator(
  overrides: Partial<IterationCoordinator> = {},
): IterationCoordinator {
  return {
    clearState: () => {},
    getLastDecomposition: () => null,
    getLastRetryContexts: () => [],
    setLastDecomposition: () => {},
    setLastRetryContexts: () => {},
    setupIterationCallbacks: () => {},
    ...overrides,
  };
}

function createMockParallelExecutionManager(
  overrides: Partial<ParallelExecutionManager> = {},
): ParallelExecutionManager {
  return {
    disable: () => {},
    getConfig: () => ({ enabled: false, maxConcurrentTasks: 1 }),
    getCurrentGroup: () => null,
    getExecutionGroups: () => [],
    getReadyTasks: () => [],
    getSummary: () => ({
      completedGroups: 0,
      currentGroupIndex: 0,
      isActive: false,
      totalGroups: 0,
    }),
    hasMoreGroups: () => false,
    initialize: () => ({ isValid: true }),
    isEnabled: () => false,
    recordTaskComplete: () => ({ allSucceeded: true, groupComplete: true }),
    recordTaskStart: () => {},
    reset: () => {},
    setRalphConfig: () => {},
    startNextGroup: () => ({ groupIndex: -1, started: false, tasks: [] }),
    ...overrides,
  };
}

function createMockBranchModeManager(
  overrides: Partial<BranchModeManager> = {},
): BranchModeManager {
  return {
    completeTaskBranch: async () => ({ success: true }),
    createPullRequestForBranch: async () => ({ success: true }),
    createTaskBranch: () => ({ success: true }),
    getBaseBranch: () => null,
    getConfig: () => null,
    getCurrentTaskBranch: () => null,
    initialize: () => ({ isValid: true }),
    isEnabled: () => false,
    reset: () => {},
    setConfig: () => {},
    setEnabled: () => {},
    setRalphConfig: () => {},
    ...overrides,
  };
}

function createMockHandlerCoordinator(
  overrides: Partial<HandlerCoordinator> = {},
): HandlerCoordinator {
  return {
    cleanup: () => {},
    getIsVerifying: () => false,
    initialize: () => {},
    ...overrides,
  };
}

function createMockOrchestrator(overrides: Partial<Orchestrator> = {}): Orchestrator {
  const createMockSession = (totalIterations: number, currentTaskIndex: number) => ({
    currentIteration: 0,
    currentTaskIndex,
    elapsedTimeSeconds: 0,
    lastUpdateTime: Date.now(),
    startTime: Date.now(),
    statistics: {
      averageDurationMs: 0,
      completedIterations: 0,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations,
    },
    status: "running" as const,
    totalIterations,
  });

  return {
    cleanup: () => {},
    completeTaskBranch: async () => ({ success: true }),
    createPullRequestForBranch: async () => ({ success: true }),
    createTaskBranch: () => ({ success: true }),
    disableParallelExecution: () => {},
    getBaseBranch: () => null,
    getBranchModeConfig: () => null,
    getConfig: () => null,
    getCurrentParallelGroup: () => null,
    getCurrentTaskBranch: () => null,
    getIsVerifying: () => false,
    getParallelConfig: () => ({ enabled: false, maxConcurrentTasks: 1 }),
    getParallelExecutionGroups: () => [],
    getParallelExecutionSummary: () => ({
      completedGroups: 0,
      currentGroupIndex: 0,
      isActive: false,
      totalGroups: 0,
    }),
    getReadyTasksForParallelExecution: () => [],
    handleFatalError: (_error, _prd, currentSession) =>
      currentSession ? { ...currentSession, status: "stopped" as const } : null,
    hasMoreParallelGroups: () => false,
    initialize: () => {},
    initializeBranchMode: () => ({ isValid: true }),
    initializeParallelExecution: () => ({ isValid: true }),
    isBranchModeEnabled: () => false,
    isParallelModeEnabled: () => false,
    recordParallelTaskComplete: () => ({ allSucceeded: true, groupComplete: true }),
    recordParallelTaskStart: () => {},
    resumeSession: (pendingSession) => ({
      remainingIterations: pendingSession.totalIterations - pendingSession.currentIteration,
      session: { ...pendingSession, status: "running" as const },
    }),
    setupIterationCallbacks: () => {},
    startNextParallelGroup: () => ({ groupIndex: -1, started: false, tasks: [] }),
    startSession: (_prd, totalIterations) => ({
      session: createMockSession(totalIterations, 0),
      taskIndex: 0,
    }),
    ...overrides,
  };
}

export function bootstrapTestServices(overrides: TestServiceOverrides = {}): void {
  resetServices();

  const testContainer: ServiceContainer = {
    branchModeManager: createMockBranchModeManager(overrides.branchModeManager),
    config: createMockConfigService(overrides.config),
    gitBranch: createMockGitBranchService(overrides.gitBranch),
    gitProvider: createMockGitProviderService(overrides.gitProvider),
    guardrails: createMockGuardrailsService(overrides.guardrails),
    handlerCoordinator: createMockHandlerCoordinator(overrides.handlerCoordinator),
    iterationCoordinator: createMockIterationCoordinator(overrides.iterationCoordinator),
    memoryMonitor: createMockMemoryMonitorService(overrides.memoryMonitor),
    orchestrator: createMockOrchestrator(overrides.orchestrator),
    parallelExecutionManager: createMockParallelExecutionManager(
      overrides.parallelExecutionManager,
    ),
    prd: createMockPrdService(overrides.prd),
    projectRegistry: createMockProjectRegistryService(overrides.projectRegistry),
    session: createMockSessionService(overrides.session),
    sessionManager: createMockSessionManager(overrides.sessionManager),
    sessionMemory: createMockSessionMemoryService(overrides.sessionMemory),
    sleepPrevention: createMockSleepPreventionService(overrides.sleepPrevention),
    usageStatistics: createMockUsageStatisticsService(overrides.usageStatistics),
  };

  initializeServices(testContainer);
}

export function teardownTestServices(): void {
  resetServices();
}
