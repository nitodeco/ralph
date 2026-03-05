import type { PrdService } from "@/lib/services/prd/types.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { SessionService } from "@/lib/services/session/types.ts";
import type { Session } from "@/lib/services/session/types.ts";

export function createServiceTestPrd(overrides: Partial<Prd> = {}): Prd {
  return {
    project: "Test Project",
    tasks: [
      { description: "First task", done: false, id: "task-1", steps: [], title: "Task 1" },
      { description: "Second task", done: false, id: "task-2", steps: [], title: "Task 2" },
    ],
    ...overrides,
  };
}

export function createServiceTestSession(overrides: Partial<Session> = {}): Session {
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

export function createServiceTestPrdOverrides(
  getPrd: () => Prd = () => createServiceTestPrd(),
): Partial<PrdService> {
  return {
    canWorkOnTask: () => ({ canWork: true }),
    createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
    deleteTask: (prd) => prd,
    findFile: () => null,
    get: () => getPrd(),
    getCurrentTaskIndex: () => 0,
    getNextTask: () => getPrd().tasks[0]?.title ?? null,
    getNextTaskWithIndex: () => {
      const nextTask = getPrd().tasks[0];

      return nextTask ? { ...nextTask, index: 0, title: nextTask.title ?? "Task" } : null;
    },
    getTaskByIndex: () => null,
    getTaskByTitle: () => null,
    invalidate: () => {},
    isComplete: () => false,
    load: () => getPrd(),
    loadInstructions: () => null,
    loadWithValidation: () => ({ prd: getPrd() }),
    reload: () => getPrd(),
    reloadWithValidation: () => ({ prd: getPrd() }),
    reorderTask: (prd) => prd,
    save: () => {},
    toggleTaskDone: (prd) => prd,
    updateTask: (prd) => prd,
  };
}

export function createServiceTestSessionOverrides(options?: {
  onSave?: (session: Session) => void;
}): Partial<SessionService> {
  return {
    completeParallelGroup: (session) => session,
    completeTaskExecution: (session) => session,
    create: (totalIterations: number, currentTaskIndex: number) =>
      createServiceTestSession({ currentTaskIndex, totalIterations }),
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
      options?.onSave?.(session);
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
    updateStatus: (session, status) => ({ ...session, lastUpdateTime: Date.now(), status }),
  };
}
