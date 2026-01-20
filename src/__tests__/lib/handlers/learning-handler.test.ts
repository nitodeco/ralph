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
			iteration: 1,
			wasSuccessful: false,
			agentError: null,
			output: "output",
			exitCode: 1,
			taskTitle: "Task A",
			retryCount: 0,
			retryContexts: [],
			verificationFailed: true,
			failedChecks: ["lint"],
		});

		const memory = getSessionMemoryService().get();

		expect(memory.failedApproaches).toContain("Verification failed: lint");
	});

	test("records lessons and success patterns after retry", () => {
		const handler = new LearningHandler({ enabled: true });
		const retryContexts: IterationLogRetryContext[] = [
			{
				attemptNumber: 1,
				failureCategory: "tooling",
				rootCause: "Missing dependency",
				contextInjected: "Install dependency",
			},
		];

		handler.recordIterationOutcome({
			iteration: 2,
			wasSuccessful: true,
			agentError: null,
			output: "output",
			exitCode: 0,
			taskTitle: "Task B",
			retryCount: 1,
			retryContexts,
			verificationFailed: false,
			failedChecks: [],
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
