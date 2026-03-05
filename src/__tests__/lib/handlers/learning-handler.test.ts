import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { LearningHandler } from "@/lib/handlers/LearningHandler.ts";
import {
  bootstrapTestServices,
  getSessionMemoryService,
  teardownTestServices,
} from "@/lib/services/index.ts";
import { createSessionMemoryService } from "@/lib/services/session-memory/implementation.ts";
import type { IterationLogRetryContext } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-learning-handler";

describe("LearningHandler", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }

    mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
    process.chdir(TEST_DIR);
    bootstrapTestServices({
      sessionMemory: createSessionMemoryService(),
    });
  });

  afterEach(() => {
    teardownTestServices();

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  test("records failed verification checks", () => {
    const handler = new LearningHandler({ enabled: true });

    handler.recordIterationOutcome({
      agentError: null,
      exitCode: 1,
      failedChecks: ["lint"],
      iteration: 1,
      output: "output",
      retryContexts: [],
      retryCount: 0,
      taskTitle: "Task A",
      verificationFailed: true,
      wasSuccessful: false,
    });

    const memory = getSessionMemoryService().get();

    expect(memory.failedApproaches).toContain("Verification failed: lint");
  });

  test("records lessons and success patterns after retry", () => {
    const handler = new LearningHandler({ enabled: true });
    const retryContexts: IterationLogRetryContext[] = [
      {
        attemptNumber: 1,
        contextInjected: "Install dependency",
        failureCategory: "tooling",
        rootCause: "Missing dependency",
      },
    ];

    handler.recordIterationOutcome({
      agentError: null,
      exitCode: 0,
      failedChecks: [],
      iteration: 2,
      output: "output",
      retryContexts,
      retryCount: 1,
      taskTitle: "Task B",
      verificationFailed: false,
      wasSuccessful: true,
    });

    const memory = getSessionMemoryService().get();

    expect(memory.lessonsLearned).toContain(
      'Task "Task B" succeeded after retry: Missing dependency was resolved',
    );
    expect(memory.successfulPatterns).toContain(
      "Recovered from tooling by addressing: Missing dependency",
    );
    expect(memory.successfulPatterns).toContain("Completed task: Task B");
  });
});
