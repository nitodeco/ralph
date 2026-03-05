import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import type { Session } from "@/lib/services/session/types.ts";
import { createSessionManager } from "@/lib/services/session-manager/implementation.ts";
import {
  createServiceTestPrd,
  createServiceTestPrdOverrides,
  createServiceTestSession,
  createServiceTestSessionOverrides,
} from "./test-infrastructure.ts";

describe("SessionManager", () => {
  let savedSession: Session | null = null;

  beforeEach(() => {
    savedSession = null;

    bootstrapTestServices({
      prd: createServiceTestPrdOverrides(),
      session: createServiceTestSessionOverrides({
        onSave: (session) => {
          savedSession = session;
        },
      }),
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

      const prd = createServiceTestPrd();
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

      const prd = createServiceTestPrd();

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

      const pendingSession = createServiceTestSession({
        currentIteration: 3,
        status: "paused",
        totalIterations: 10,
      });

      const result = sessionManager.resumeSession(pendingSession, createServiceTestPrd());

      expect(result.session.status).toBe("running");
      expect(result.remainingIterations).toBe(7);
    });

    test("returns at least 1 remaining iteration", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const pendingSession = createServiceTestSession({
        currentIteration: 10,
        status: "paused",
        totalIterations: 10,
      });

      const result = sessionManager.resumeSession(pendingSession, createServiceTestPrd());

      expect(result.remainingIterations).toBe(1);
    });

    test("saves the resumed session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: null, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const pendingSession = createServiceTestSession({ status: "paused" });

      sessionManager.resumeSession(pendingSession, createServiceTestPrd());

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

      const currentSession = createServiceTestSession();
      const result = sessionManager.handleFatalError(
        "Test error",
        createServiceTestPrd(),
        currentSession,
      );

      expect(result.session?.status).toBe("stopped");
      expect(result.wasHandled).toBe(true);
    });

    test("handles fatal error without active session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: 1, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const result = sessionManager.handleFatalError("Test error", createServiceTestPrd(), null);

      expect(result.session).toBeNull();
      expect(result.wasHandled).toBe(true);
    });

    test("saves the stopped session", () => {
      const sessionManager = createSessionManager({
        getAgentStoreState: () => ({ exitCode: 1, output: "", retryCount: 0 }),
        getIterationStoreState: () => ({ current: 0 }),
      });

      const currentSession = createServiceTestSession();

      sessionManager.handleFatalError("Test error", createServiceTestPrd(), currentSession);

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

      const result = sessionManager.startSession(createServiceTestPrd(), 5);

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

      const session = createServiceTestSession({
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

      const prd = createServiceTestPrd({
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
