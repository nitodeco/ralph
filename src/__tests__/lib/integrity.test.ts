import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkRalphDirectoryIntegrity, formatIntegrityIssues } from "@/lib/integrity.ts";
import { ensureRalphDirExists, RALPH_DIR } from "@/lib/paths.ts";

const TEST_DIR = "/tmp/ralph-test-integrity";
const TEST_RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("integrity functions", () => {
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

	describe("checkRalphDirectoryIntegrity", () => {
		test("returns directoryExists false when .ralph does not exist", () => {
			process.chdir("/tmp");
			const result = checkRalphDirectoryIntegrity();

			expect(result.directoryExists).toBe(false);
			expect(result.issues).toEqual([]);
		});

		test("returns no issues for valid directory", () => {
			const result = checkRalphDirectoryIntegrity();

			expect(result.directoryExists).toBe(true);
			expect(result.issues.length).toBe(0);
		});

		test("creates .gitignore if missing", () => {
			const gitignorePath = join(RALPH_DIR, ".gitignore");

			if (existsSync(gitignorePath)) {
				unlinkSync(gitignorePath);
			}

			const result = checkRalphDirectoryIntegrity();

			expect(result.gitignoreCreated).toBe(true);
			expect(existsSync(gitignorePath)).toBe(true);
		});

		test("does not create .gitignore if it exists", () => {
			writeFileSync(join(RALPH_DIR, ".gitignore"), "existing content");
			const result = checkRalphDirectoryIntegrity();

			expect(result.gitignoreCreated).toBe(false);
		});

		test("validates config.json when present", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), JSON.stringify({ agent: "cursor" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid config.json", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "config.json")).toBe(true);
			expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
		});

		test("reports config validation errors", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), JSON.stringify({ agent: "invalid" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "config.json")).toBe(true);
		});

		test("reports config validation warnings", () => {
			writeFileSync(
				join(RALPH_DIR, "config.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const warnings = result.issues.filter((issue) => issue.severity === "warning");

			if (warnings.length > 0) {
				expect(warnings.some((w) => w.file === "config.json")).toBe(true);
			}
		});

		test("validates prd.json when present", () => {
			writeFileSync(join(RALPH_DIR, "prd.json"), JSON.stringify({ project: "Test", tasks: [] }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid prd.json", () => {
			writeFileSync(join(RALPH_DIR, "prd.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("reports missing project field in PRD", () => {
			writeFileSync(join(RALPH_DIR, "prd.json"), JSON.stringify({ tasks: [] }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("reports missing tasks field in PRD", () => {
			writeFileSync(join(RALPH_DIR, "prd.json"), JSON.stringify({ project: "Test" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("validates session.json when present", () => {
			writeFileSync(
				join(RALPH_DIR, "session.json"),
				JSON.stringify({
					startTime: Date.now(),
					lastUpdateTime: Date.now(),
					currentIteration: 0,
					totalIterations: 10,
					currentTaskIndex: 0,
					status: "running",
					elapsedTimeSeconds: 0,
					statistics: {
						totalIterations: 10,
						completedIterations: 0,
						failedIterations: 0,
						successfulIterations: 0,
						totalDurationMs: 0,
						averageDurationMs: 0,
						successRate: 0,
						iterationTimings: [],
					},
				}),
			);
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid session.json", () => {
			writeFileSync(join(RALPH_DIR, "session.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "session.json")).toBe(true);
		});

		test("reports missing required fields in session.json", () => {
			writeFileSync(join(RALPH_DIR, "session.json"), JSON.stringify({ startTime: Date.now() }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "session.json")).toBe(true);
		});

		test("handles multiple issues across files", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid }");
			writeFileSync(join(RALPH_DIR, "prd.json"), "{ invalid }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("formatIntegrityIssues", () => {
		test("returns null when no issues", () => {
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toBeNull();
		});

		test("formats single error", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).not.toBeNull();
			expect(formatted).toContain("Integrity check found issues");
			expect(formatted).toContain("config.json");
		});

		test("formats errors with ✗ symbol", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toContain("✗");
		});

		test("formats warnings with ⚠ symbol", () => {
			writeFileSync(
				join(RALPH_DIR, "config.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			if (formatted) {
				const warnings = result.issues.filter((issue) => issue.severity === "warning");

				if (warnings.length > 0) {
					expect(formatted).toContain("⚠");
				}
			}
		});

		test("groups errors before warnings", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			writeFileSync(
				join(RALPH_DIR, "prd.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			if (formatted) {
				const errorIndex = formatted.indexOf("✗");
				const warningIndex = formatted.indexOf("⚠");

				if (errorIndex !== -1 && warningIndex !== -1) {
					expect(errorIndex).toBeLessThan(warningIndex);
				}
			}
		});

		test("includes file name and message", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toContain("config.json:");
			expect(formatted).toContain("Failed to parse");
		});

		test("ends with newline", () => {
			writeFileSync(join(RALPH_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toEndWith("\n");
		});
	});
});
