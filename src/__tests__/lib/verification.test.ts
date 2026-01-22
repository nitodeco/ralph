import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import {
	formatVerificationResult,
	generateVerificationRetryContext,
	runCheck,
	runVerification,
} from "@/lib/verification.ts";
import type { VerificationConfig, VerificationResult } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-verification";

beforeEach(() => {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}

	mkdirSync(TEST_DIR, { recursive: true });
	process.chdir(TEST_DIR);
});

afterEach(() => {
	process.chdir("/tmp");

	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true });
	}
});

describe("runCheck", () => {
	test("returns error for empty command", async () => {
		const result = await runCheck("test", "");

		expect(result.passed).toBe(false);
		expect(result.output).toContain("Invalid command");
		expect(result.name).toBe("test");
	});

	test("executes successful command", async () => {
		const result = await runCheck("test", "echo success");

		expect(result.passed).toBe(true);
		expect(result.output).toContain("success");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("executes failing command", async () => {
		const result = await runCheck("test", "exit 1");

		expect(result.passed).toBe(false);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("handles command errors gracefully", async () => {
		const result = await runCheck("test", "nonexistentcommand12345");

		expect(result.passed).toBe(false);
		expect(result.output).toBeDefined();
	});

	test("truncates output to 2000 characters", async () => {
		const longOutput = "x".repeat(3000);
		const result = await runCheck("test", `echo "${longOutput}"`);

		if (result.output) {
			expect(result.output.length).toBeLessThanOrEqual(2000);
		}
	});

	test("includes stderr in output", async () => {
		const result = await runCheck("test", "echo error >&2 && exit 1");

		expect(result.passed).toBe(false);
		expect(result.output).toBeDefined();
	});
});

describe("runVerification", () => {
	test("returns passed when verification is disabled", async () => {
		const config: VerificationConfig = {
			enabled: false,
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.passed).toBe(true);
		expect(result.checks).toEqual([]);
		expect(result.failedChecks).toEqual([]);
		expect(result.totalDurationMs).toBe(0);
	});

	test("runs build command when provided", async () => {
		const config: VerificationConfig = {
			enabled: true,
			buildCommand: "echo build",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.checks).toHaveLength(1);
		expect(result.checks.at(0)?.name).toBe("build");
		expect(result.passed).toBe(true);
	});

	test("runs lint command when provided", async () => {
		const config: VerificationConfig = {
			enabled: true,
			lintCommand: "echo lint",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.checks).toHaveLength(1);
		expect(result.checks.at(0)?.name).toBe("lint");
	});

	test("runs test command when provided", async () => {
		const config: VerificationConfig = {
			enabled: true,
			testCommand: "echo test",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.checks).toHaveLength(1);
		expect(result.checks.at(0)?.name).toBe("test");
	});

	test("runs all commands when provided", async () => {
		const config: VerificationConfig = {
			enabled: true,
			buildCommand: "echo build",
			lintCommand: "echo lint",
			testCommand: "echo test",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.checks).toHaveLength(3);
		expect(result.checks.some((check) => check.name === "build")).toBe(true);
		expect(result.checks.some((check) => check.name === "lint")).toBe(true);
		expect(result.checks.some((check) => check.name === "test")).toBe(true);
	});

	test("runs custom checks", async () => {
		const config: VerificationConfig = {
			enabled: true,
			customChecks: ["echo custom1", "echo custom2"],
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.checks).toHaveLength(2);
		expect(result.checks.at(0)?.name).toBe("custom-1");
		expect(result.checks.at(1)?.name).toBe("custom-2");
	});

	test("marks as failed when check fails", async () => {
		const config: VerificationConfig = {
			enabled: true,
			buildCommand: "exit 1",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.passed).toBe(false);
		expect(result.failedChecks).toContain("build");
	});

	test("tracks multiple failed checks", async () => {
		const config: VerificationConfig = {
			enabled: true,
			buildCommand: "exit 1",
			lintCommand: "exit 1",
			testCommand: "echo test",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.passed).toBe(false);
		expect(result.failedChecks.length).toBe(2);
		expect(result.failedChecks).toContain("build");
		expect(result.failedChecks).toContain("lint");
	});

	test("calculates total duration", async () => {
		const config: VerificationConfig = {
			enabled: true,
			buildCommand: "echo build",
			failOnWarning: false,
		};
		const result = await runVerification(config);

		expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
	});
});

describe("formatVerificationResult", () => {
	test("formats empty checks", () => {
		const result: VerificationResult = {
			passed: true,
			checks: [],
			failedChecks: [],
			totalDurationMs: 0,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("=== Verification Results ===");
		expect(formatted).toContain("No verification checks configured");
	});

	test("formats successful check", () => {
		const result: VerificationResult = {
			passed: true,
			checks: [
				{
					name: "build",
					passed: true,
					output: "Build successful",
					durationMs: 100,
				},
			],
			failedChecks: [],
			totalDurationMs: 100,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("PASS: build");
		expect(formatted).toContain("100ms");
		expect(formatted).toContain("Status: PASSED");
	});

	test("formats failed check", () => {
		const result: VerificationResult = {
			passed: false,
			checks: [
				{
					name: "build",
					passed: false,
					output: "Build failed\nError line 1\nError line 2",
					durationMs: 200,
				},
			],
			failedChecks: ["build"],
			totalDurationMs: 200,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("FAIL: build");
		expect(formatted).toContain("Build failed");
		expect(formatted).toContain("Status: FAILED");
	});

	test("truncates long output", () => {
		const longOutput = Array.from({ length: 10 }, (_, index) => `Line ${index + 1}`).join("\n");
		const result: VerificationResult = {
			passed: false,
			checks: [
				{
					name: "test",
					passed: false,
					output: longOutput,
					durationMs: 50,
				},
			],
			failedChecks: ["test"],
			totalDurationMs: 50,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("...(truncated)");
	});

	test("formats multiple checks", () => {
		const result: VerificationResult = {
			passed: false,
			checks: [
				{ name: "build", passed: true, output: "", durationMs: 100 },
				{ name: "test", passed: false, output: "Failed", durationMs: 200 },
			],
			failedChecks: ["test"],
			totalDurationMs: 300,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("PASS: build");
		expect(formatted).toContain("FAIL: test");
		expect(formatted).toContain("Total: 2 checks, 1 failed");
	});

	test("includes duration in summary", () => {
		const result: VerificationResult = {
			passed: true,
			checks: [{ name: "build", passed: true, output: "", durationMs: 150 }],
			failedChecks: [],
			totalDurationMs: 150,
		};
		const formatted = formatVerificationResult(result);

		expect(formatted).toContain("Duration: 150ms");
	});
});

describe("generateVerificationRetryContext", () => {
	test("returns empty string when verification passed", () => {
		const result: VerificationResult = {
			passed: true,
			checks: [],
			failedChecks: [],
			totalDurationMs: 0,
		};
		const context = generateVerificationRetryContext(result);

		expect(context).toBe("");
	});

	test("returns empty string when no failed checks", () => {
		const result: VerificationResult = {
			passed: true,
			checks: [{ name: "build", passed: true, output: "", durationMs: 100 }],
			failedChecks: [],
			totalDurationMs: 100,
		};
		const context = generateVerificationRetryContext(result);

		expect(context).toBe("");
	});

	test("generates context for failed check", () => {
		const result: VerificationResult = {
			passed: false,
			checks: [
				{
					name: "build",
					passed: false,
					output: "Build error message",
					durationMs: 100,
				},
			],
			failedChecks: ["build"],
			totalDurationMs: 100,
		};
		const context = generateVerificationRetryContext(result);

		expect(context).toContain("## Verification Failed");
		expect(context).toContain("### build check failed");
		expect(context).toContain("Build error message");
		expect(context).toContain("Please fix the issues");
	});

	test("includes multiple failed checks", () => {
		const result: VerificationResult = {
			passed: false,
			checks: [
				{ name: "build", passed: false, output: "Build failed", durationMs: 100 },
				{ name: "test", passed: false, output: "Tests failed", durationMs: 200 },
			],
			failedChecks: ["build", "test"],
			totalDurationMs: 300,
		};
		const context = generateVerificationRetryContext(result);

		expect(context).toContain("### build check failed");
		expect(context).toContain("### test check failed");
		expect(context).toContain("Build failed");
		expect(context).toContain("Tests failed");
	});

	test("truncates long output to 1000 characters", () => {
		const longOutput = "x".repeat(2000);
		const result: VerificationResult = {
			passed: false,
			checks: [
				{
					name: "build",
					passed: false,
					output: longOutput,
					durationMs: 100,
				},
			],
			failedChecks: ["build"],
			totalDurationMs: 100,
		};
		const context = generateVerificationRetryContext(result);
		const outputInContext = context.match(/```\n([\s\S]*?)\n```/)?.[1];

		if (outputInContext) {
			expect(outputInContext.length).toBeLessThanOrEqual(1000);
		}
	});

	test("only includes failed checks in context", () => {
		const result: VerificationResult = {
			passed: false,
			checks: [
				{ name: "build", passed: true, output: "", durationMs: 100 },
				{ name: "test", passed: false, output: "Failed", durationMs: 200 },
			],
			failedChecks: ["test"],
			totalDurationMs: 300,
		};
		const context = generateVerificationRetryContext(result);

		expect(context).not.toContain("### build check failed");
		expect(context).toContain("### test check failed");
	});
});
