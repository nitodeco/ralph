import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { writeFileIdempotent } from "@/lib/idempotency.ts";
import { ensureProjectDirExists, getSessionFilePath } from "@/lib/paths.ts";
import type {
  ActiveTaskExecution,
  IterationTiming,
  ParallelExecutionGroup,
  ParallelSessionState,
  Session,
  SessionService,
  SessionStatistics,
  SessionStatus,
  TaskExecutionInfo,
} from "./types.ts";
import { isSession } from "./validation.ts";

function createInitialStatistics(totalIterations: number): SessionStatistics {
  return {
    averageDurationMs: 0,
    completedIterations: 0,
    failedIterations: 0,
    iterationTimings: [],
    successRate: 0,
    successfulIterations: 0,
    totalDurationMs: 0,
    totalIterations,
  };
}

function createInitialParallelState(maxConcurrentTasks: number): ParallelSessionState {
  return {
    activeExecutions: [],
    currentGroupIndex: -1,
    executionGroups: [],
    isParallelMode: true,
    maxConcurrentTasks,
  };
}

function createTaskExecution(taskInfo: TaskExecutionInfo): ActiveTaskExecution {
  return {
    endTime: null,
    lastError: null,
    processId: taskInfo.processId,
    retryCount: 0,
    startTime: Date.now(),
    status: "running",
    taskId: taskInfo.taskId,
    taskIndex: taskInfo.taskIndex,
    taskTitle: taskInfo.taskTitle,
  };
}

function findActiveExecution(
  executions: ActiveTaskExecution[],
  taskId: string,
): ActiveTaskExecution | undefined {
  return executions.find((execution) => execution.taskId === taskId);
}

function updateExecutionInArray(
  executions: ActiveTaskExecution[],
  taskId: string,
  updater: (execution: ActiveTaskExecution) => ActiveTaskExecution,
): ActiveTaskExecution[] {
  return executions.map((execution) =>
    execution.taskId === taskId ? updater(execution) : execution,
  );
}

export function createSessionService(): SessionService {
  function load(): Session | null {
    const sessionFilePath = getSessionFilePath();

    if (!existsSync(sessionFilePath)) {
      return null;
    }

    try {
      const content = readFileSync(sessionFilePath, "utf8");
      const parsed: unknown = JSON.parse(content);

      if (!isSession(parsed)) {
        return null;
      }

      if (!parsed.statistics) {
        parsed.statistics = createInitialStatistics(parsed.totalIterations);
        save(parsed);
      }

      return parsed;
    } catch {
      return null;
    }
  }

  function save(session: Session): void {
    ensureProjectDirExists();
    writeFileIdempotent(getSessionFilePath(), JSON.stringify(session, null, 2));
  }

  function deleteSession(): void {
    const sessionFilePath = getSessionFilePath();

    if (existsSync(sessionFilePath)) {
      unlinkSync(sessionFilePath);
    }
  }

  function exists(): boolean {
    return existsSync(getSessionFilePath());
  }

  function create(totalIterations: number, currentTaskIndex: number): Session {
    const now = Date.now();

    return {
      currentIteration: 0,
      currentTaskIndex,
      elapsedTimeSeconds: 0,
      lastUpdateTime: now,
      startTime: now,
      statistics: createInitialStatistics(totalIterations),
      status: "running",
      totalIterations,
    };
  }

  function recordIterationStart(session: Session, iteration: number): Session {
    const now = Date.now();
    const existingTiming = session.statistics.iterationTimings.find(
      (timing) => timing.iteration === iteration,
    );

    let updatedTimings: IterationTiming[];

    if (existingTiming) {
      updatedTimings = session.statistics.iterationTimings.map((timing) =>
        timing.iteration === iteration ? { ...timing, startTime: now } : timing,
      );
    } else {
      updatedTimings = [
        ...session.statistics.iterationTimings,
        {
          durationMs: null,
          endTime: null,
          iteration,
          startTime: now,
        },
      ];
    }

    return {
      ...session,
      lastUpdateTime: now,
      statistics: {
        ...session.statistics,
        iterationTimings: updatedTimings,
      },
    };
  }

  function recordIterationEnd(
    session: Session,
    iteration: number,
    wasSuccessful: boolean,
  ): Session {
    const now = Date.now();
    const existingTiming = session.statistics.iterationTimings.find(
      (timing) => timing.iteration === iteration,
    );

    let updatedTimings: IterationTiming[];
    let durationMs = 0;

    if (existingTiming) {
      durationMs = now - existingTiming.startTime;
      updatedTimings = session.statistics.iterationTimings.map((timing) =>
        timing.iteration === iteration ? { ...timing, durationMs, endTime: now } : timing,
      );
    } else {
      updatedTimings = [
        ...session.statistics.iterationTimings,
        {
          durationMs: 0,
          endTime: now,
          iteration,
          startTime: now,
        },
      ];
    }

    const completedIterations = session.statistics.completedIterations + 1;
    const successfulIterations = wasSuccessful
      ? session.statistics.successfulIterations + 1
      : session.statistics.successfulIterations;
    const failedIterations = wasSuccessful
      ? session.statistics.failedIterations
      : session.statistics.failedIterations + 1;
    const totalDurationMs = session.statistics.totalDurationMs + durationMs;
    const averageDurationMs = completedIterations > 0 ? totalDurationMs / completedIterations : 0;
    const successRate =
      completedIterations > 0 ? (successfulIterations / completedIterations) * 100 : 0;

    return {
      ...session,
      lastUpdateTime: now,
      statistics: {
        ...session.statistics,
        averageDurationMs,
        completedIterations,
        failedIterations,
        iterationTimings: updatedTimings,
        successRate,
        successfulIterations,
        totalDurationMs,
      },
    };
  }

  function updateIteration(
    session: Session,
    currentIteration: number,
    currentTaskIndex: number,
    elapsedTimeSeconds: number,
  ): Session {
    return {
      ...session,
      currentIteration,
      currentTaskIndex,
      elapsedTimeSeconds,
      lastUpdateTime: Date.now(),
    };
  }

  function updateStatus(session: Session, status: SessionStatus): Session {
    return {
      ...session,
      lastUpdateTime: Date.now(),
      status,
    };
  }

  function isResumable(session: Session | null): boolean {
    if (!session) {
      return false;
    }

    return (
      session.status === "running" || session.status === "paused" || session.status === "stopped"
    );
  }

  function enableParallelMode(session: Session, maxConcurrentTasks: number): Session {
    return {
      ...session,
      lastUpdateTime: Date.now(),
      parallelState: createInitialParallelState(maxConcurrentTasks),
    };
  }

  function disableParallelMode(session: Session): Session {
    const { parallelState: _, ...sessionWithoutParallel } = session;

    return {
      ...sessionWithoutParallel,
      lastUpdateTime: Date.now(),
    };
  }

  function isParallelMode(session: Session): boolean {
    return session.parallelState?.isParallelMode ?? false;
  }

  function startParallelGroup(session: Session, groupIndex: number): Session {
    if (!session.parallelState) {
      return session;
    }

    const newGroup: ParallelExecutionGroup = {
      endTime: null,
      groupIndex,
      isComplete: false,
      startTime: Date.now(),
      taskExecutions: [],
    };

    return {
      ...session,
      lastUpdateTime: Date.now(),
      parallelState: {
        ...session.parallelState,
        currentGroupIndex: groupIndex,
        executionGroups: [...session.parallelState.executionGroups, newGroup],
      },
    };
  }

  function completeParallelGroup(session: Session, groupIndex: number): Session {
    if (!session.parallelState) {
      return session;
    }

    const now = Date.now();
    const updatedGroups = session.parallelState.executionGroups.map((group) => {
      if (group.groupIndex !== groupIndex) {
        return group;
      }

      const completedExecutions = session.parallelState?.activeExecutions.filter((execution) =>
        group.taskExecutions.some((taskExecution) => taskExecution.taskId === execution.taskId),
      );

      return {
        ...group,
        endTime: now,
        isComplete: true,
        taskExecutions: completedExecutions ?? group.taskExecutions,
      };
    });

    return {
      ...session,
      lastUpdateTime: now,
      parallelState: {
        ...session.parallelState,
        activeExecutions: session.parallelState.activeExecutions.filter(
          (execution) => execution.status === "running",
        ),
        executionGroups: updatedGroups,
      },
    };
  }

  function getCurrentParallelGroup(session: Session): ParallelExecutionGroup | null {
    if (!session.parallelState) {
      return null;
    }

    const { currentGroupIndex, executionGroups } = session.parallelState;

    if (currentGroupIndex < 0) {
      return null;
    }

    return (
      executionGroups.find(
        (group) => group.groupIndex === currentGroupIndex && !group.isComplete,
      ) ?? null
    );
  }

  function startTaskExecution(session: Session, taskInfo: TaskExecutionInfo): Session {
    if (!session.parallelState) {
      return session;
    }

    const newExecution = createTaskExecution(taskInfo);
    const currentGroup = getCurrentParallelGroup(session);

    if (!currentGroup) {
      return {
        ...session,
        lastUpdateTime: Date.now(),
        parallelState: {
          ...session.parallelState,
          activeExecutions: [...session.parallelState.activeExecutions, newExecution],
        },
      };
    }

    const updatedGroups = session.parallelState.executionGroups.map((group) =>
      group.groupIndex === currentGroup.groupIndex
        ? { ...group, taskExecutions: [...group.taskExecutions, newExecution] }
        : group,
    );

    return {
      ...session,
      lastUpdateTime: Date.now(),
      parallelState: {
        ...session.parallelState,
        activeExecutions: [...session.parallelState.activeExecutions, newExecution],
        executionGroups: updatedGroups,
      },
    };
  }

  function completeTaskExecution(
    session: Session,
    taskId: string,
    wasSuccessful: boolean,
  ): Session {
    if (!session.parallelState) {
      return session;
    }

    const now = Date.now();
    const status = wasSuccessful ? "completed" : "failed";

    const updatedActiveExecutions = updateExecutionInArray(
      session.parallelState.activeExecutions,
      taskId,
      (execution) => ({
        ...execution,
        endTime: now,
        status,
      }),
    );

    const updatedGroups = session.parallelState.executionGroups.map((group) => ({
      ...group,
      taskExecutions: updateExecutionInArray(group.taskExecutions, taskId, (execution) => ({
        ...execution,
        endTime: now,
        status,
      })),
    }));

    return {
      ...session,
      lastUpdateTime: now,
      parallelState: {
        ...session.parallelState,
        activeExecutions: updatedActiveExecutions,
        executionGroups: updatedGroups,
      },
    };
  }

  function failTaskExecution(session: Session, taskId: string, error: string): Session {
    if (!session.parallelState) {
      return session;
    }

    const now = Date.now();

    const updatedActiveExecutions = updateExecutionInArray(
      session.parallelState.activeExecutions,
      taskId,
      (execution) => ({
        ...execution,
        endTime: now,
        lastError: error,
        status: "failed",
      }),
    );

    const updatedGroups = session.parallelState.executionGroups.map((group) => ({
      ...group,
      taskExecutions: updateExecutionInArray(group.taskExecutions, taskId, (execution) => ({
        ...execution,
        endTime: now,
        lastError: error,
        status: "failed",
      })),
    }));

    return {
      ...session,
      lastUpdateTime: now,
      parallelState: {
        ...session.parallelState,
        activeExecutions: updatedActiveExecutions,
        executionGroups: updatedGroups,
      },
    };
  }

  function retryTaskExecution(session: Session, taskId: string): Session {
    if (!session.parallelState) {
      return session;
    }

    const now = Date.now();

    const updatedActiveExecutions = updateExecutionInArray(
      session.parallelState.activeExecutions,
      taskId,
      (execution) => ({
        ...execution,
        endTime: null,
        lastError: null,
        retryCount: execution.retryCount + 1,
        startTime: now,
        status: "running",
      }),
    );

    const updatedGroups = session.parallelState.executionGroups.map((group) => ({
      ...group,
      taskExecutions: updateExecutionInArray(group.taskExecutions, taskId, (execution) => ({
        ...execution,
        endTime: null,
        lastError: null,
        retryCount: execution.retryCount + 1,
        startTime: now,
        status: "running",
      })),
    }));

    return {
      ...session,
      lastUpdateTime: now,
      parallelState: {
        ...session.parallelState,
        activeExecutions: updatedActiveExecutions,
        executionGroups: updatedGroups,
      },
    };
  }

  function getActiveExecutions(session: Session): ActiveTaskExecution[] {
    if (!session.parallelState) {
      return [];
    }

    return session.parallelState.activeExecutions.filter(
      (execution) => execution.status === "running",
    );
  }

  function getTaskExecution(session: Session, taskId: string): ActiveTaskExecution | null {
    if (!session.parallelState) {
      return null;
    }

    return findActiveExecution(session.parallelState.activeExecutions, taskId) ?? null;
  }

  function isTaskExecuting(session: Session, taskId: string): boolean {
    if (!session.parallelState) {
      return false;
    }

    const execution = findActiveExecution(session.parallelState.activeExecutions, taskId);

    return execution?.status === "running";
  }

  function getActiveExecutionCount(session: Session): number {
    return getActiveExecutions(session).length;
  }

  return {
    completeParallelGroup,
    completeTaskExecution,
    create,
    delete: deleteSession,
    disableParallelMode,
    enableParallelMode,
    exists,
    failTaskExecution,
    getActiveExecutionCount,
    getActiveExecutions,
    getCurrentParallelGroup,
    getTaskExecution,
    isParallelMode,
    isResumable,
    isTaskExecuting,
    load,
    recordIterationEnd,
    recordIterationStart,
    retryTaskExecution,
    save,
    startParallelGroup,
    startTaskExecution,
    updateIteration,
    updateStatus,
  };
}
