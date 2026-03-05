import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createIterationCoordinator } from "@/lib/services/iteration-coordinator/implementation.ts";
import type { DecompositionRequest, IterationLogRetryContext } from "@/types.ts";
import {
  createServiceTestPrd,
  createServiceTestPrdOverrides,
  createServiceTestSession,
  createServiceTestSessionOverrides,
} from "./test-infrastructure.ts";

describe("IterationCoordinator", () => {
  let callbacksCalled: {
    iterationStart: number[];
    iterationComplete: number[];
    allComplete: boolean;
    maxIterations: boolean;
    maxRuntime: boolean;
  };
  let lastSpecificTask: string | null;

  beforeEach(() => {
    callbacksCalled = {
      allComplete: false,
      iterationComplete: [],
      iterationStart: [],
      maxIterations: false,
      maxRuntime: false,
    };
    lastSpecificTask = null;

    bootstrapTestServices({
      prd: createServiceTestPrdOverrides(),
      session: createServiceTestSessionOverrides(),
    });
  });

  afterEach(() => {
    teardownTestServices();
  });

  function createMockDependencies() {
    return {
      completeTaskBranch: async () => ({ success: true }),
      createTaskBranch: () => ({ success: true }),
      getAgentStoreState: () => ({
        error: null,
        exitCode: null,
        isComplete: false,
        output: "",
        reset: () => {},
        retryCount: 0,
      }),
      getAppStoreState: () => ({
        clearManualNextTask: () => {
          lastSpecificTask = null;
        },
        currentSession: createServiceTestSession(),
        elapsedTime: 0,
        getEffectiveNextTask: () => lastSpecificTask,
        isReviewingTechnicalDebt: false,
        isVerifying: false,
        lastDecomposition: null,
        lastTechnicalDebtReport: null,
        lastVerificationResult: null,
        manualNextTask: null,
        prd: createServiceTestPrd(),
        setPrd: () => {},
      }),
      getIterationStoreState: () => ({
        current: 1,
        restartCurrentIteration: () => {},
        setCallbacks: (callbacks: {
          onIterationStart?: (iteration: number) => void;
          onIterationComplete?: (iteration: number) => void;
          onAllComplete?: () => void;
          onMaxIterations?: () => void;
          onMaxRuntime?: () => void;
        }) => {
          if (callbacks.onIterationStart) {
            callbacksCalled.iterationStart.push(1);
          }
        },
        total: 10,
      }),
      resetAgent: () => {},
      setAppStoreState: () => {},
      startAgent: (specificTask?: string | null) => {
        lastSpecificTask = specificTask ?? null;
      },
      stopAgent: () => {},
    };
  }

  describe("setupIterationCallbacks", () => {
    test("sets up callbacks on iteration store", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      iterationCoordinator.setupIterationCallbacks({
        branchModeConfig: null,
        branchModeEnabled: false,
        config: { agent: "cursor" },
        iterations: 10,
        skipVerification: false,
      });

      expect(callbacksCalled.iterationStart.length).toBeGreaterThan(0);
    });

    test("caches config for later use", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      iterationCoordinator.setupIterationCallbacks({
        branchModeConfig: null,
        branchModeEnabled: false,
        config: { agent: "cursor", maxRetries: 5 },
        iterations: 10,
        skipVerification: true,
      });

      expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
    });
  });

  describe("retry context management", () => {
    test("getLastRetryContexts returns empty array initially", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
    });

    test("setLastRetryContexts stores contexts", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      const contexts: IterationLogRetryContext[] = [
        {
          attemptNumber: 1,
          contextInjected: "Error log",
          failureCategory: "build_error",
          rootCause: "Missing dependency",
        },
      ];

      iterationCoordinator.setLastRetryContexts(contexts);

      expect(iterationCoordinator.getLastRetryContexts()).toEqual(contexts);
    });

    test("setLastRetryContexts overwrites previous contexts", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      const contexts1: IterationLogRetryContext[] = [
        {
          attemptNumber: 1,
          contextInjected: "Context 1",
          failureCategory: "build_error",
          rootCause: "Error 1",
        },
      ];

      const contexts2: IterationLogRetryContext[] = [
        {
          attemptNumber: 2,
          contextInjected: "Context 2",
          failureCategory: "test_failure",
          rootCause: "Error 2",
        },
      ];

      iterationCoordinator.setLastRetryContexts(contexts1);
      iterationCoordinator.setLastRetryContexts(contexts2);

      expect(iterationCoordinator.getLastRetryContexts()).toEqual(contexts2);
    });
  });

  describe("decomposition management", () => {
    test("getLastDecomposition returns null initially", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      expect(iterationCoordinator.getLastDecomposition()).toBeNull();
    });

    test("setLastDecomposition stores decomposition", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      const decomposition: DecompositionRequest = {
        originalTaskTitle: "Complex task",
        reason: "Too complex",
        suggestedSubtasks: [
          { description: "First part", steps: ["Step 1"], title: "Subtask 1" },
          { description: "Second part", steps: ["Step 2"], title: "Subtask 2" },
        ],
      };

      iterationCoordinator.setLastDecomposition(decomposition);

      expect(iterationCoordinator.getLastDecomposition()).toEqual(decomposition);
    });

    test("setLastDecomposition with null clears decomposition", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      const decomposition: DecompositionRequest = {
        originalTaskTitle: "Complex task",
        reason: "Too complex",
        suggestedSubtasks: [],
      };

      iterationCoordinator.setLastDecomposition(decomposition);
      iterationCoordinator.setLastDecomposition(null);

      expect(iterationCoordinator.getLastDecomposition()).toBeNull();
    });
  });

  describe("clearState", () => {
    test("clears all state", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      const contexts: IterationLogRetryContext[] = [
        {
          attemptNumber: 1,
          contextInjected: "Context",
          failureCategory: "build_error",
          rootCause: "Error",
        },
      ];

      const decomposition: DecompositionRequest = {
        originalTaskTitle: "Task",
        reason: "Reason",
        suggestedSubtasks: [],
      };

      iterationCoordinator.setLastRetryContexts(contexts);
      iterationCoordinator.setLastDecomposition(decomposition);

      iterationCoordinator.clearState();

      expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
      expect(iterationCoordinator.getLastDecomposition()).toBeNull();
    });

    test("can be called multiple times safely", () => {
      const iterationCoordinator = createIterationCoordinator(createMockDependencies());

      iterationCoordinator.clearState();
      iterationCoordinator.clearState();
      iterationCoordinator.clearState();

      expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
      expect(iterationCoordinator.getLastDecomposition()).toBeNull();
    });
  });

  describe("state isolation", () => {
    test("multiple coordinators have independent state", () => {
      const coordinator1 = createIterationCoordinator(createMockDependencies());
      const coordinator2 = createIterationCoordinator(createMockDependencies());

      const contexts1: IterationLogRetryContext[] = [
        {
          attemptNumber: 1,
          contextInjected: "Context 1",
          failureCategory: "build_error",
          rootCause: "Error 1",
        },
      ];

      const contexts2: IterationLogRetryContext[] = [
        {
          attemptNumber: 2,
          contextInjected: "Context 2",
          failureCategory: "test_failure",
          rootCause: "Error 2",
        },
      ];

      coordinator1.setLastRetryContexts(contexts1);
      coordinator2.setLastRetryContexts(contexts2);

      expect(coordinator1.getLastRetryContexts()).toEqual(contexts1);
      expect(coordinator2.getLastRetryContexts()).toEqual(contexts2);
    });
  });
});
