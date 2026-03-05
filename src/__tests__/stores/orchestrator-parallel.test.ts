import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureProjectDirExists, getPrdJsonPath } from "@/lib/paths.ts";
import {
  type OrchestratorCallbacks,
  bootstrapTestServices,
  createOrchestrator,
  createParallelExecutionManager,
  createPrdService,
  getOrchestrator,
  setParallelExecutionManagerDependencies,
  teardownTestServices,
} from "@/lib/services/index.ts";
import { useAppStore } from "@/stores/appStore.ts";
import type { Prd, RalphConfig } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-orchestrator-parallel";

function createMockCallbacks(): OrchestratorCallbacks {
  return {
    onAppStateChange: () => {},
    onFatalError: () => {},
    onIterationComplete: () => {},
    onPrdUpdate: () => {},
    onRestartIteration: () => {},
    onVerificationStateChange: () => {},
    setMaxRuntimeMs: () => {},
  };
}

function writePrdFile(prd: Prd): void {
  ensureProjectDirExists();
  writeFileSync(getPrdJsonPath(), JSON.stringify(prd, null, 2));
}

function createMockSession() {
  return {
    currentIteration: 0,
    currentTaskIndex: 0,
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
      totalIterations: 10,
    },
    status: "running" as const,
    totalIterations: 10,
  };
}

describe("orchestrator parallel execution", () => {
  beforeEach(() => {
    setParallelExecutionManagerDependencies({
      getAppStoreState: () => {
        const state = useAppStore.getState();

        return {
          currentSession: state.currentSession,
          prd: state.prd,
        };
      },
      setAppStoreState: (newState) => {
        useAppStore.setState(newState);
      },
    });

    bootstrapTestServices({
      orchestrator: createOrchestrator(),
      parallelExecutionManager: createParallelExecutionManager({
        getAppStoreState: () => {
          const state = useAppStore.getState();

          return {
            currentSession: state.currentSession,
            prd: state.prd,
          };
        },
        setAppStoreState: (newState) => {
          useAppStore.setState(newState);
        },
      }),
      prd: createPrdService(),
      session: {
        completeParallelGroup: (session, groupIndex) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                executionGroups: session.parallelState.executionGroups.map((g) =>
                  g.groupIndex === groupIndex ? { ...g, isComplete: true, endTime: Date.now() } : g,
                ),
              }
            : undefined,
        }),
        completeTaskExecution: (session, taskId, wasSuccessful) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                activeExecutions: session.parallelState.activeExecutions.map((e) =>
                  e.taskId === taskId
                    ? {
                        ...e,
                        status: wasSuccessful ? ("completed" as const) : ("failed" as const),
                        endTime: Date.now(),
                      }
                    : e,
                ),
              }
            : undefined,
        }),
        create: (totalIterations: number, currentTaskIndex: number) => ({
          ...createMockSession(),
          totalIterations,
          currentTaskIndex,
        }),
        delete: () => {},
        disableParallelMode: (session) => {
          const { parallelState: _, ...rest } = session;

          return { ...rest, lastUpdateTime: Date.now() };
        },
        enableParallelMode: (session, maxConcurrentTasks) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: {
            isParallelMode: true,
            currentGroupIndex: -1,
            executionGroups: [],
            activeExecutions: [],
            maxConcurrentTasks,
          },
        }),
        exists: () => false,
        failTaskExecution: (session, taskId, error) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                activeExecutions: session.parallelState.activeExecutions.map((e) =>
                  e.taskId === taskId
                    ? { ...e, status: "failed" as const, endTime: Date.now(), lastError: error }
                    : e,
                ),
              }
            : undefined,
        }),
        getActiveExecutionCount: (session) =>
          session.parallelState?.activeExecutions.filter((e) => e.status === "running").length ?? 0,
        getActiveExecutions: (session) =>
          session.parallelState?.activeExecutions.filter((e) => e.status === "running") ?? [],
        getCurrentParallelGroup: (session) => {
          if (!session.parallelState) {
            return null;
          }

          const idx = session.parallelState.currentGroupIndex;

          return session.parallelState.executionGroups.find((g) => g.groupIndex === idx) ?? null;
        },
        getTaskExecution: (session, taskId) =>
          session.parallelState?.activeExecutions.find((e) => e.taskId === taskId) ?? null,
        isParallelMode: (s) => s.parallelState?.isParallelMode ?? false,
        isResumable: () => false,
        isTaskExecuting: (session, taskId) =>
          session.parallelState?.activeExecutions.some(
            (e) => e.taskId === taskId && e.status === "running",
          ) ?? false,
        load: () => null,
        recordIterationEnd: (s) => s,
        recordIterationStart: (s) => s,
        retryTaskExecution: (session, taskId) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                activeExecutions: session.parallelState.activeExecutions.map((e) =>
                  e.taskId === taskId
                    ? { ...e, status: "running" as const, retryCount: e.retryCount + 1 }
                    : e,
                ),
              }
            : undefined,
        }),
        save: () => {},
        startParallelGroup: (session, groupIndex) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                currentGroupIndex: groupIndex,
                executionGroups: [
                  ...session.parallelState.executionGroups,
                  {
                    groupIndex,
                    startTime: Date.now(),
                    endTime: null,
                    taskExecutions: [],
                    isComplete: false,
                  },
                ],
              }
            : undefined,
        }),
        startTaskExecution: (session, taskInfo) => ({
          ...session,
          lastUpdateTime: Date.now(),
          parallelState: session.parallelState
            ? {
                ...session.parallelState,
                activeExecutions: [
                  ...session.parallelState.activeExecutions,
                  {
                    taskId: taskInfo.taskId,
                    taskTitle: taskInfo.taskTitle,
                    taskIndex: taskInfo.taskIndex,
                    status: "running" as const,
                    startTime: Date.now(),
                    endTime: null,
                    processId: taskInfo.processId,
                    retryCount: 0,
                    lastError: null,
                  },
                ],
              }
            : undefined,
        }),
        updateIteration: (s) => s,
        updateStatus: (s) => s,
      },
    });

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }

    mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    getOrchestrator().cleanup();
    teardownTestServices();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("initialization", () => {
    test("initializes with parallel execution disabled by default", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
        },
        createMockCallbacks(),
      );

      expect(getOrchestrator().isParallelModeEnabled()).toBe(false);
      expect(getOrchestrator().getParallelConfig()).toEqual({
        enabled: false,
        maxConcurrentTasks: 1,
      });
    });

    test("initializes with parallel execution enabled", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
        },
        createMockCallbacks(),
      );

      expect(getOrchestrator().isParallelModeEnabled()).toBe(true);
      expect(getOrchestrator().getParallelConfig()).toEqual({
        enabled: true,
        maxConcurrentTasks: 4,
      });
    });
  });

  describe("parallel execution initialization", () => {
    test("validates dependencies and computes parallel groups", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
          {
            dependsOn: ["task-1"],
            description: "",
            done: false,
            id: "task-3",
            steps: [],
            title: "Task 3",
          },
        ],
      };

      writePrdFile(prd);

      const result = getOrchestrator().initializeParallelExecution(prd);

      expect(result.isValid).toBe(true);
      expect(getOrchestrator().getParallelExecutionGroups().length).toBeGreaterThan(0);
    });

    test("fails validation for cyclic dependencies", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          {
            dependsOn: ["task-2"],
            description: "",
            done: false,
            id: "task-1",
            steps: [],
            title: "Task 1",
          },
          {
            dependsOn: ["task-1"],
            description: "",
            done: false,
            id: "task-2",
            steps: [],
            title: "Task 2",
          },
        ],
      };

      writePrdFile(prd);

      const result = getOrchestrator().initializeParallelExecution(prd);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid task dependencies");
    });

    test("skips initialization when parallel mode is disabled", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [{ description: "", done: false, id: "task-1", steps: [], title: "Task 1" }],
      };

      writePrdFile(prd);

      const result = getOrchestrator().initializeParallelExecution(prd);

      expect(result.isValid).toBe(true);
      expect(getOrchestrator().getParallelExecutionGroups().length).toBe(0);
    });
  });

  describe("parallel group management", () => {
    test("starts next parallel group and returns tasks", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
          { description: "", done: false, id: "task-3", steps: [], title: "Task 3" },
        ],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);

      const result = getOrchestrator().startNextParallelGroup();

      expect(result.started).toBe(true);
      expect(result.groupIndex).toBe(0);
      expect(result.tasks.length).toBeGreaterThan(0);
      expect(result.tasks.length).toBeLessThanOrEqual(2);
    });

    test("returns false when no more groups available", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 10 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [{ description: "", done: false, id: "task-1", steps: [], title: "Task 1" }],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);
      getOrchestrator().startNextParallelGroup();

      getOrchestrator().recordParallelTaskComplete("task-1", "Task 1", true);

      const result = getOrchestrator().startNextParallelGroup();

      expect(result.started).toBe(false);
      expect(result.groupIndex).toBe(-1);
    });
  });

  describe("task completion tracking", () => {
    test("tracks task completion within a group", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 3 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
        ],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);
      getOrchestrator().startNextParallelGroup();

      const result1 = getOrchestrator().recordParallelTaskComplete("task-1", "Task 1", true);

      expect(result1.groupComplete).toBe(false);

      const result2 = getOrchestrator().recordParallelTaskComplete("task-2", "Task 2", true);

      expect(result2.groupComplete).toBe(true);
      expect(result2.allSucceeded).toBe(true);
    });

    test("tracks failed tasks separately", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 3 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
        ],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);
      getOrchestrator().startNextParallelGroup();

      getOrchestrator().recordParallelTaskComplete("task-1", "Task 1", true);
      const result = getOrchestrator().recordParallelTaskComplete(
        "task-2",
        "Task 2",
        false,
        "Test error",
      );

      expect(result.groupComplete).toBe(true);
      expect(result.allSucceeded).toBe(false);
    });
  });

  describe("parallel execution summary", () => {
    test("returns accurate summary", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
          {
            dependsOn: ["task-1"],
            description: "",
            done: false,
            id: "task-3",
            steps: [],
            title: "Task 3",
          },
        ],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);

      const summaryBefore = getOrchestrator().getParallelExecutionSummary();

      expect(summaryBefore.totalGroups).toBeGreaterThan(0);
      expect(summaryBefore.completedGroups).toBe(0);
      expect(summaryBefore.isActive).toBe(false);

      getOrchestrator().startNextParallelGroup();

      const summaryDuring = getOrchestrator().getParallelExecutionSummary();

      expect(summaryDuring.isActive).toBe(true);
      expect(summaryDuring.currentGroupIndex).toBe(0);
    });

    test("hasMoreParallelGroups returns correct value", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 10 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [{ description: "", done: false, id: "task-1", steps: [], title: "Task 1" }],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);

      expect(getOrchestrator().hasMoreParallelGroups()).toBe(true);

      getOrchestrator().startNextParallelGroup();
      getOrchestrator().recordParallelTaskComplete("task-1", "Task 1", true);

      expect(getOrchestrator().hasMoreParallelGroups()).toBe(false);
    });
  });

  describe("disable parallel execution", () => {
    test("disables parallel mode and resets state", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [
          { description: "", done: false, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
        ],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);

      expect(getOrchestrator().isParallelModeEnabled()).toBe(true);

      getOrchestrator().disableParallelExecution();

      expect(getOrchestrator().isParallelModeEnabled()).toBe(false);
      expect(getOrchestrator().getParallelExecutionGroups().length).toBe(0);
      expect(getOrchestrator().getCurrentParallelGroup()).toBeNull();
    });

    test("is idempotent when already disabled", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
        },
        createMockCallbacks(),
      );

      expect(getOrchestrator().isParallelModeEnabled()).toBe(false);

      getOrchestrator().disableParallelExecution();

      expect(getOrchestrator().isParallelModeEnabled()).toBe(false);
    });
  });

  describe("cleanup", () => {
    test("resets all parallel execution state on cleanup", () => {
      const config: RalphConfig = { agent: "cursor" };

      getOrchestrator().initialize(
        {
          config,
          iterations: 5,
          parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
        },
        createMockCallbacks(),
      );

      const prd: Prd = {
        project: "Test",
        tasks: [{ description: "", done: false, id: "task-1", steps: [], title: "Task 1" }],
      };

      writePrdFile(prd);
      getOrchestrator().initializeParallelExecution(prd);
      getOrchestrator().startNextParallelGroup();

      getOrchestrator().cleanup();

      expect(getOrchestrator().isParallelModeEnabled()).toBe(false);
      expect(getOrchestrator().getParallelExecutionGroups().length).toBe(0);
      expect(getOrchestrator().getCurrentParallelGroup()).toBeNull();
    });
  });
});
