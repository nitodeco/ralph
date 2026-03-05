import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { Session } from "@/lib/services/session/types.ts";
import { createSessionManager } from "@/lib/services/session-manager/implementation.ts";

function createMockSession(overrides: Partial<Session> = {}): Session {
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
    status: "running",
    totalIterations: 10,
    ...overrides,
  };
}

function createMockPrd(overrides: Partial<Prd> = {}): Prd {
  return {
    project: "Test Project",
    tasks: [
      { description: "First task", done: false, id: "task-1", steps: [], title: "Task 1" },
      { description: "Second task", done: false, id: "task-2", steps: [], title: "Task 2" },
    ],
    ...overrides,
  };
}

describe("SessionManager", () => {
  let savedSession: Session | null = null;

  beforeEach(() => {
    savedSession = null;

    bootstrapTestServices({
      prd: {
        canWorkOnTask: () => ({ canWork: true }),
        createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
        deleteTask: (prd) => prd,
        findFile: () => null,
        get: () => createMockPrd(),
        getCurrentTaskIndex: () => 0,
        getNextTask: () => createMockPrd().tasks[0]?.title ?? null,
        getNextTaskWithIndex: () => {
          const task = createMockPrd().tasks[0];

          return task ? { ...task, title: task.title ?? "Task", index: 0 } : null;
        },
        getTaskByIndex: () => null,
        getTaskByTitle: () => null,
        invalidate: () => {},
        isComplete: () => false,
        load: () => createMockPrd(),
        loadInstructions: () => null,
        loadWithValidation: () => ({ prd: createMockPrd() }),
        reload: () => createMockPrd(),
        reloadWithValidation: () => ({ prd: createMockPrd() }),
        reorderTask: (prd) => prd,
        save: () => {},
        toggleTaskDone: (prd) => prd,
        updateTask: (prd) => prd,
      },
      session: {
        completeParallelGroup: (session) => session,
        completeTaskExecution: (session) => session,
        create: (totalIterations: number, currentTaskIndex: number) =>
          createMockSession({ totalIterations, currentTaskIndex }),
        delete: () => {},
        disableParallelMode: (session) => session,
        enableParallelMode: (session) => session,
        exists: () => false,
        failTaskExecution: (session) => session,
        getActiveExecutionCount: () => 0,
        getActiveExecutions: () => [],
        getCurrentParallelGroup: () => null,
        getTaskExecution: () => null,
        isParallelMode: () => false,
        isResumable: () => false,
        isTaskExecuting: () => false,
        load: () => null,
        recordIterationEnd: (session) => ({ ...session, lastUpdateTime: Date.now() }),
        recordIterationStart: (session) => ({ ...session, lastUpdateTime: Date.now() }),
        retryTaskExecution: (session) => session,
        save: (session) => {
          savedSession = session;
        },
        startParallelGroup: (session) => session,
        startTaskExecution: (session) => session,
        updateIteration: (session, currentIteration, currentTaskIndex, elapsedTimeSeconds) => ({
          ...session,
          currentIteration,
          currentTaskIndex,
          elapsedTimeSeconds,
          lastUpdateTime: Date.now(),
        }),
        updateStatus: (session, status) => ({ ...session, status, lastUpdateTime: Date.now() }),
      },
      sessionMemory: {
        addFailedApproach: () => {},
        addLesson: () => {},
        addSuccessPattern: () => {},
        addTaskNote: () => {},
        clear: () => {},
        exists: () => false,
        exportAsMarkdown: () => "",
        formatForPrompt: () => "",
        formatForTask: () => "",
        get: () => ({
          projectName: "Test Project",
          lessonsLearned: [],
          successfulPatterns: [],
          failedApproaches: [],
          taskNotes: {},
          lastUpdated: new Date().toISOString(),
        }),
        getStats: () => ({
          lessonsCount: 0,
          patternsCount: 0,
          failedApproachesCount: 0,
          taskNotesCount: 0,
          lastUpdated: null,
        }),
        getTaskNote: () => null,
        initialize: () => ({
          projectName: "Test Project",
          lessonsLearned: [],
          successfulPatterns: [],
          failedApproaches: [],
          taskNotes: {},
          lastUpdated: new Date().toISOString(),
        }),
        invalidate: () => {},
        load: () => ({
          projectName: "Test Project",
          lessonsLearned: [],
          successfulPatterns: [],
          failedApproaches: [],
          taskNotes: {},
          lastUpdated: new Date().toISOString(),
        }),
        save: () => {},
      },
      usageStatistics: {
        exists: () => false,
        formatForDisplay: () => "",
        get: () => ({
          version: 1,
          projectName: "Test Project",
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          lifetime: {
            totalSessions: 0,
            totalIterations: 0,
            totalTasksCompleted: 0,
            totalTasksAttempted: 0,
            totalDurationMs: 0,
            successfulIterations: 0,
            failedIterations: 0,
            averageIterationsPerSession: 0,
            averageTasksPerSession: 0,
            averageSessionDurationMs: 0,
            overallSuccessRate: 0,
          },
          recentSessions: [],
          dailyUsage: [],
        }),
        getDailyUsage: () => [],
        getRecentSessions: () => [],
        getSummary: () => ({
          totalSessions: 0,
          totalIterations: 0,
          totalTasksCompleted: 0,
          totalDurationMs: 0,
          overallSuccessRate: 0,
          averageSessionDurationMs: 0,
          averageIterationsPerSession: 0,
          lastSessionAt: null,
          streakDays: 0,
        }),
        initialize: () => ({
          version: 1,
          projectName: "Test Project",
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          lifetime: {
            totalSessions: 0,
            totalIterations: 0,
            totalTasksCompleted: 0,
            totalTasksAttempted: 0,
            totalDurationMs: 0,
            successfulIterations: 0,
            failedIterations: 0,
            averageIterationsPerSession: 0,
            averageTasksPerSession: 0,
            averageSessionDurationMs: 0,
            overallSuccessRate: 0,
          },
          recentSessions: [],
          dailyUsage: [],
        }),
        invalidate: () => {},
        load: () => ({
          version: 1,
          projectName: "Test Project",
          createdAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          lifetime: {
            totalSessions: 0,
            totalIterations: 0,
            totalTasksCompleted: 0,
            totalTasksAttempted: 0,
            totalDurationMs: 0,
            successfulIterations: 0,
            failedIterations: 0,
            averageIterationsPerSession: 0,
            averageTasksPerSession: 0,
            averageSessionDurationMs: 0,
            overallSuccessRate: 0,
          },
          recentSessions: [],
          dailyUsage: [],
        }),
        recordSession: () => {},
        save: () => {},
      },
    });
  });

  afterEach(() => {
    teardownTestServices();
  });

  describe("startSession", () => {
    test("creates a new session with correct parameters", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const prd = createMockPrd();
      const result = sessionManager.startSession(prd, 10);

      expect(result.session).toBeDefined();
      expect(result.session.totalIterations).toBe(10);
      expect(result.taskIndex).toBe(0);
    });

    test("saves the session after creation", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const prd = createMockPrd();

      sessionManager.startSession(prd, 5);

      expect(savedSession).not.toBeNull();
      expect(savedSession?.totalIterations).toBe(5);
    });

    test("handles null PRD gracefully", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const result = sessionManager.startSession(null, 10);

      expect(result.session).toBeDefined();
      expect(result.taskIndex).toBe(0);
    });
  });

  describe("resumeSession", () => {
    test("resumes an existing session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const pendingSession = createMockSession({
        currentIteration: 3,
        status: "paused",
        totalIterations: 10,
      });

      const result = sessionManager.resumeSession(pendingSession, createMockPrd());

      expect(result.session.status).toBe("running");
      expect(result.remainingIterations).toBe(7);
    });

    test("returns at least 1 remaining iteration", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const pendingSession = createMockSession({
        currentIteration: 10,
        status: "paused",
        totalIterations: 10,
      });

      const result = sessionManager.resumeSession(pendingSession, createMockPrd());

      expect(result.remainingIterations).toBe(1);
    });

    test("saves the resumed session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const pendingSession = createMockSession({ status: "paused" });

      sessionManager.resumeSession(pendingSession, createMockPrd());

      expect(savedSession).not.toBeNull();
      expect(savedSession?.status).toBe("running");
    });
  });

  describe("handleFatalError", () => {
    test("handles fatal error with active session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: 1, output: "error output", retryCount: 2 }),
        getIterationStoreState: () => ({ current: 5 }),
      });

      const currentSession = createMockSession();
      const result = sessionManager.handleFatalError("Test error", createMockPrd(), currentSession);

      expect(result.session?.status).toBe("stopped");
      expect(result.wasHandled).toBe(true);
    });

    test("handles fatal error without active session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: 1, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const result = sessionManager.handleFatalError("Test error", createMockPrd(), null);

      expect(result.session).toBeNull();
      expect(result.wasHandled).toBe(true);
    });

    test("saves the stopped session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: 1, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const currentSession = createMockSession();

      sessionManager.handleFatalError("Test error", createMockPrd(), currentSession);

      expect(savedSession).not.toBeNull();
      expect(savedSession?.status).toBe("stopped");
    });
  });

  describe("setConfig", () => {
    test("caches config for later use", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      sessionManager.setConfig({ agent: "cursor" });

      const result = sessionManager.startSession(createMockPrd(), 5);

      expect(result.session).toBeDefined();
    });
  });

  describe("recordUsageStatistics", () => {
    test("records statistics for completed session", () => {
      let recordedSessionData: unknown = null;

      teardownTestServices();

      const mockUsageStats = {
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

      bootstrapTestServices({
        usageStatistics: {
          exists: () => false,
          formatForDisplay: () => "",
          get: () => mockUsageStats,
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
          initialize: () => mockUsageStats,
          invalidate: () => {},
          load: () => mockUsageStats,
          recordSession: (data) => {
            recordedSessionData = data;
          },
          save: () => {},
        },
      });

      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const session = createMockSession({
        statistics: {
          averageDurationMs: 6000,
          completedIterations: 8,
          failedIterations: 2,
          iterationTimings: [],
          successRate: 0.75,
          successfulIterations: 6,
          totalDurationMs: 60_000,
          totalIterations: 10,
        },
      });

      const prd = createMockPrd({
        tasks: [
          { description: "", done: true, id: "task-1", steps: [], title: "Task 1" },
          { description: "", done: false, id: "task-2", steps: [], title: "Task 2" },
        ],
      });

      sessionManager.recordUsageStatistics(session, prd, "completed");

      expect(recordedSessionData).not.toBeNull();
      expect((recordedSessionData as { status: string }).status).toBe("completed");
      expect((recordedSessionData as { tasksCompleted: number }).tasksCompleted).toBe(1);
    });
  });
});
