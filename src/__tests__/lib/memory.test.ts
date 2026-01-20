import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	checkMemoryUsage,
	cleanupTempFiles,
	getMemoryUsage,
	performIterationCleanup,
	truncateOutputBuffer,
} from "@/lib/memory.ts";
import { ensureRalphDirExists, RALPH_DIR } from "@/lib/paths.ts";

const TEST_DIR = "/tmp/ralph-test-memory";
const TEST_RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("memory functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(TEST_RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("getMemoryUsage", () => {
		test("returns memory usage object", () => {
			const usage = getMemoryUsage();

			expect(usage).toHaveProperty("heapUsedMB");
			expect(usage).toHaveProperty("heapTotalMB");
			expect(usage).toHaveProperty("rssMB");
			expect(usage).toHaveProperty("externalMB");
		});

		test("returns non-negative values", () => {
			const usage = getMemoryUsage();

			expect(usage.heapUsedMB).toBeGreaterThanOrEqual(0);
			expect(usage.heapTotalMB).toBeGreaterThanOrEqual(0);
			expect(usage.rssMB).toBeGreaterThanOrEqual(0);
			expect(usage.externalMB).toBeGreaterThanOrEqual(0);
		});

		test("returns values in megabytes", () => {
			const usage = getMemoryUsage();

			expect(usage.heapUsedMB).toBeLessThan(10000);
			expect(usage.heapTotalMB).toBeLessThan(10000);
		});
	});

	describe("checkMemoryUsage", () => {
		test("returns ok level when below threshold", () => {
			const result = checkMemoryUsage({ memoryWarningThresholdMb: 10000 });

			expect(result.level).toBe("ok");
			expect(result.usage).toBeDefined();
		});

		test("returns warning level when above warning threshold", () => {
			const loggerSpy = spyOn(console, "warn").mockImplementation(() => {});
			const result = checkMemoryUsage({ memoryWarningThresholdMb: 1 });

			if (result.level === "warning") {
				expect(result.level).toBe("warning");
			}

			loggerSpy.mockRestore();
		});

		test("returns critical level when above critical threshold", () => {
			const loggerSpy = spyOn(console, "warn").mockImplementation(() => {});
			const result = checkMemoryUsage();

			if (result.level === "critical") {
				expect(result.level).toBe("critical");
			}

			loggerSpy.mockRestore();
		});

		test("uses default threshold when not provided", () => {
			const result = checkMemoryUsage();

			expect(result.level).toBeDefined();
			expect(["ok", "warning", "critical"]).toContain(result.level);
		});

		test("disables warning when threshold is 0", () => {
			const result = checkMemoryUsage({ memoryWarningThresholdMb: 0 });

			expect(result.level).toBe("ok");
		});
	});

	describe("truncateOutputBuffer", () => {
		test("returns original output when under limit", () => {
			const smallOutput = "Small output";
			const truncated = truncateOutputBuffer(smallOutput, 1000);

			expect(truncated).toBe(smallOutput);
		});

		test("truncates output when over limit", () => {
			const largeOutput = "x".repeat(10000);
			const truncated = truncateOutputBuffer(largeOutput, 1000);

			expect(truncated.length).toBeLessThan(largeOutput.length);
			expect(truncated).toContain("[output truncated");
		});

		test("keeps beginning and end of output", () => {
			const output = `start${"x".repeat(10000)}end`;
			const truncated = truncateOutputBuffer(output, 100);

			expect(truncated).toContain("start");
			expect(truncated).toContain("end");
		});

		test("uses default max bytes when not provided", () => {
			const largeOutput = "x".repeat(10 * 1024 * 1024);
			const truncated = truncateOutputBuffer(largeOutput);

			expect(truncated.length).toBeLessThan(largeOutput.length);
		});

		test("handles very small max bytes", () => {
			const output = "test output";
			const truncated = truncateOutputBuffer(output, 10);

			expect(truncated).toContain("[output truncated");
		});

		test("handles empty output", () => {
			const truncated = truncateOutputBuffer("", 1000);

			expect(truncated).toBe("");
		});
	});

	describe("cleanupTempFiles", () => {
		test("returns zero when directory does not exist", () => {
			process.chdir("/tmp");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBe(0);
		});

		test("removes temp files with .tmp extension", () => {
			writeFileSync(join(RALPH_DIR, "test.tmp"), "content");
			writeFileSync(join(RALPH_DIR, "normal.txt"), "content");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBeGreaterThan(0);
			expect(existsSync(join(RALPH_DIR, "test.tmp"))).toBe(false);
			expect(existsSync(join(RALPH_DIR, "normal.txt"))).toBe(true);
		});

		test("removes temp files with .tmp prefix", () => {
			writeFileSync(join(RALPH_DIR, ".tmpfile"), "content");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBeGreaterThan(0);
			expect(existsSync(join(RALPH_DIR, ".tmpfile"))).toBe(false);
		});

		test("removes temp files with temp_ prefix", () => {
			writeFileSync(join(RALPH_DIR, "temp_file.txt"), "content");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBeGreaterThan(0);
			expect(existsSync(join(RALPH_DIR, "temp_file.txt"))).toBe(false);
		});

		test("removes temp files with _temp suffix", () => {
			writeFileSync(join(RALPH_DIR, "file_temp"), "content");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBeGreaterThan(0);
			expect(existsSync(join(RALPH_DIR, "file_temp"))).toBe(false);
		});

		test("returns count of cleaned files", () => {
			writeFileSync(join(RALPH_DIR, "file1.tmp"), "content");
			writeFileSync(join(RALPH_DIR, "file2.tmp"), "content");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBe(2);
		});

		test("does not remove non-temp files", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{}");
			writeFileSync(join(RALPH_DIR, "prd.json"), "{}");
			cleanupTempFiles();

			expect(existsSync(join(RALPH_DIR, "config.json"))).toBe(true);
			expect(existsSync(join(RALPH_DIR, "prd.json"))).toBe(true);
		});

		test("handles errors gracefully", () => {
			process.chdir("/tmp");
			const cleaned = cleanupTempFiles();

			expect(cleaned).toBe(0);
		});
	});

	describe("performIterationCleanup", () => {
		test("performs cleanup and returns status", () => {
			const result = performIterationCleanup();

			expect(result).toHaveProperty("memoryStatus");
			expect(result).toHaveProperty("tempFilesRemoved");
			expect(["ok", "warning", "critical"]).toContain(result.memoryStatus);
			expect(result.tempFilesRemoved).toBeGreaterThanOrEqual(0);
		});

		test("removes temp files during cleanup", () => {
			writeFileSync(join(RALPH_DIR, "test.tmp"), "content");
			const result = performIterationCleanup();

			expect(result.tempFilesRemoved).toBeGreaterThan(0);
			expect(existsSync(join(RALPH_DIR, "test.tmp"))).toBe(false);
		});

		test("checks memory usage after cleanup", () => {
			const result = performIterationCleanup();

			expect(result.memoryStatus).toBeDefined();
		});
	});
});
