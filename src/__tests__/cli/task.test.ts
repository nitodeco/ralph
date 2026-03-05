import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { handleTaskDone, handleTaskUndone, printCurrentTask } from "@/cli/commands/task.ts";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import type { Prd } from "@/types.ts";

function createPrdFixture(overrides: Partial<Prd> = {}): Prd {
  return {
    project: "Task Test Project",
    tasks: [
      {
        description: "First task",
        done: false,
        id: "task-1",
        steps: ["step one"],
        title: "Task One",
      },
      {
        description: "Second task",
        done: false,
        id: "task-2",
        steps: ["step two"],
        title: "Task Two",
      },
    ],
    ...overrides,
  };
}

describe("task CLI commands", () => {
  let currentPrd: Prd;
  let logMessages: string[];
  let errorMessages: string[];
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    currentPrd = createPrdFixture();
    logMessages = [];
    errorMessages = [];

    bootstrapTestServices({
      prd: {
        get: () => currentPrd,
        save: (updatedPrd) => {
          currentPrd = updatedPrd;
        },
      },
    });

    console.log = mock((...messageParts: unknown[]) => {
      logMessages.push(messageParts.map((messagePart) => String(messagePart)).join(" "));
    });

    console.error = mock((...messageParts: unknown[]) => {
      errorMessages.push(messageParts.map((messagePart) => String(messagePart)).join(" "));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    teardownTestServices();
  });

  test("handleTaskDone marks a task done by title in JSON mode", () => {
    handleTaskDone("Task Two", true);

    expect(currentPrd.tasks[1]?.done).toBe(true);
    expect(logMessages).toHaveLength(1);

    const parsedOutput = JSON.parse(logMessages[0] ?? "{}") as {
      success: boolean;
      previousStatus: string;
      task: { index: number; status: string; title: string };
      noChange?: boolean;
    };

    expect(parsedOutput.success).toBe(true);
    expect(parsedOutput.previousStatus).toBe("pending");
    expect(parsedOutput.task).toEqual({
      index: 2,
      status: "done",
      title: "Task Two",
    });
    expect(parsedOutput.noChange).toBeUndefined();
  });

  test("handleTaskDone reports noChange when task is already done", () => {
    currentPrd = createPrdFixture({
      tasks: [
        {
          description: "First task",
          done: true,
          id: "task-1",
          steps: ["step one"],
          title: "Task One",
        },
      ],
    });

    handleTaskDone("1", true);

    const parsedOutput = JSON.parse(logMessages[0] ?? "{}") as {
      previousStatus: string;
      noChange?: boolean;
      task: { status: string };
    };

    expect(parsedOutput.previousStatus).toBe("done");
    expect(parsedOutput.noChange).toBe(true);
    expect(parsedOutput.task.status).toBe("done");
  });

  test("handleTaskUndone marks a done task back to pending", () => {
    currentPrd = createPrdFixture({
      tasks: [
        {
          description: "First task",
          done: true,
          id: "task-1",
          steps: ["step one"],
          title: "Task One",
        },
      ],
    });

    handleTaskUndone("1", true);

    expect(currentPrd.tasks[0]?.done).toBe(false);

    const parsedOutput = JSON.parse(logMessages[0] ?? "{}") as {
      previousStatus: string;
      task: { status: string };
    };

    expect(parsedOutput.previousStatus).toBe("done");
    expect(parsedOutput.task.status).toBe("pending");
  });

  test("printCurrentTask returns allTasksComplete when all tasks are done", () => {
    currentPrd = createPrdFixture({
      tasks: [
        {
          description: "First task",
          done: true,
          id: "task-1",
          steps: ["step one"],
          title: "Task One",
        },
      ],
    });

    printCurrentTask(true);

    const parsedOutput = JSON.parse(logMessages[0] ?? "{}") as {
      allTasksComplete: boolean;
      task: unknown;
    };

    expect(parsedOutput.allTasksComplete).toBe(true);
    expect(parsedOutput.task).toBeNull();
    expect(errorMessages).toHaveLength(0);
  });
});
