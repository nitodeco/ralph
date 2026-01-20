import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { VerificationHandler } from "@/lib/handlers/VerificationHandler.ts";
import type { VerificationConfig, VerificationResult } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-verification-handler";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("VerificationHandler", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	test("tracks verification state and result", async () => {
		const stateChanges: Array<{
			isVerifying: boolean;
			result: VerificationResult | null;
		}> = [];

		const handler = new VerificationHandler({
			onStateChange: (isVerifying, result) => {
				stateChanges.push({ isVerifying, result });
			},
		});

		const config: VerificationConfig = {
			enabled: false,
			failOnWarning: false,
		};

		const result = await handler.run(config);

		expect(result.passed).toBe(true);
		expect(handler.getLastResult()?.passed).toBe(true);
		expect(handler.getIsRunning()).toBe(false);
		expect(stateChanges.length).toBe(2);
		expect(stateChanges[0]).toEqual({ isVerifying: true, result: null });
		expect(stateChanges[1]?.isVerifying).toBe(false);
		expect(stateChanges[1]?.result?.passed).toBe(true);
	});
});
