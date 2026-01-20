import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
	analyzePatterns,
	clearFailureHistory,
	formatPatternReport,
	generatePatternReport,
	getFailureHistoryStats,
	getSuggestedGuardrails,
	loadFailureHistory,
	recordFailure,
} from "@/lib/failure-patterns.ts";
import { ensureRalphDirExists, FAILURE_HISTORY_FILE_PATH } from "@/lib/paths.ts";

const TEST_DIR = "/tmp/ralph-test-failure-patterns";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("failure-patterns functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("loadFailureHistory", () => {
		test("returns empty history when file does not exist", () => {
			const history = loadFailureHistory();

			expect(history.entries).toEqual([]);
			expect(history.patterns).toEqual([]);
			expect(history.lastAnalyzedAt).toBeNull();
		});

		test("loads existing history file", () => {
			const _entry = recordFailure({
				error: "Build failed",
				output: "Error output",
				taskTitle: "Task 1",
				exitCode: 1,
				iteration: 1,
			});
			const loaded = loadFailureHistory();

			expect(loaded.entries).toHaveLength(1);
			expect(loaded.entries[0]?.error).toBe("Build failed");
		});

		test("handles corrupted JSON gracefully", () => {
			writeFileSync(FAILURE_HISTORY_FILE_PATH, "{ invalid json }");
			const history = loadFailureHistory();

			expect(history.entries).toEqual([]);
			expect(history.patterns).toEqual([]);
		});
	});

	describe("recordFailure", () => {
		test("records failure entry", () => {
			const entry = recordFailure({
				error: "Test error",
				output: "Error output",
				taskTitle: "Task 1",
				exitCode: 1,
				iteration: 1,
			});

			expect(entry.error).toBe("Test error");
			expect(entry.taskTitle).toBe("Task 1");
			expect(entry.exitCode).toBe(1);
			expect(entry.iteration).toBe(1);
			expect(entry.timestamp).toBeDefined();
			expect(entry.category).toBeDefined();
			expect(entry.rootCause).toBeDefined();

			const history = loadFailureHistory();

			expect(history.entries).toHaveLength(1);
		});

		test("limits history to max entries", () => {
			for (let index = 0; index < 110; index++) {
				recordFailure({
					error: `Error ${index}`,
					output: "",
					taskTitle: "Task",
					exitCode: 1,
					iteration: index,
				});
			}

			const history = loadFailureHistory();

			expect(history.entries.length).toBeLessThanOrEqual(100);
			expect(history.entries[0]?.error).not.toBe("Error 0");
		});

		test("categorizes errors correctly", () => {
			const entry = recordFailure({
				error: "Build failed",
				output: "",
				taskTitle: "Task",
				exitCode: null,
				iteration: 1,
			});

			expect(entry.category).toBe("build_failure");
		});
	});

	describe("analyzePatterns", () => {
		test("returns empty array when no failures", () => {
			const patterns = analyzePatterns();

			expect(patterns).toEqual([]);
		});

		test("returns empty array when only one failure", () => {
			recordFailure({
				error: "Error 1",
				output: "",
				taskTitle: "Task",
				exitCode: 1,
				iteration: 1,
			});
			const patterns = analyzePatterns();

			expect(patterns).toEqual([]);
		});

		test("groups similar failures into patterns", () => {
			recordFailure({
				error: "Build failed: TypeScript error",
				output: "",
				taskTitle: "Task 1",
				exitCode: 1,
				iteration: 1,
			});
			recordFailure({
				error: "Build failed: TypeScript error",
				output: "",
				taskTitle: "Task 2",
				exitCode: 1,
				iteration: 2,
			});
			const patterns = analyzePatterns();

			expect(patterns.length).toBeGreaterThan(0);
			expect(patterns[0]?.occurrences).toBe(2);
		});

		test("tracks affected tasks", () => {
			recordFailure({
				error: "Same error",
				output: "",
				taskTitle: "Task 1",
				exitCode: 1,
				iteration: 1,
			});
			recordFailure({
				error: "Same error",
				output: "",
				taskTitle: "Task 2",
				exitCode: 1,
				iteration: 2,
			});
			const patterns = analyzePatterns();

			if (patterns.length > 0) {
				expect(patterns[0]?.affectedTasks).toContain("Task 1");
				expect(patterns[0]?.affectedTasks).toContain("Task 2");
			}
		});

		test("sorts patterns by occurrences", () => {
			recordFailure({ error: "Error A", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error A", output: "", taskTitle: "Task", exitCode: 1, iteration: 2 });
			recordFailure({ error: "Error B", output: "", taskTitle: "Task", exitCode: 1, iteration: 3 });
			const patterns = analyzePatterns();

			if (patterns.length >= 2) {
				expect(patterns[0]?.occurrences).toBeGreaterThanOrEqual(patterns[1]?.occurrences ?? 0);
			}
		});

		test("updates lastAnalyzedAt timestamp", () => {
			const history1 = loadFailureHistory();

			expect(history1.lastAnalyzedAt).toBeNull();

			recordFailure({ error: "Error", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error", output: "", taskTitle: "Task", exitCode: 1, iteration: 2 });
			analyzePatterns();

			const history2 = loadFailureHistory();

			expect(history2.lastAnalyzedAt).not.toBeNull();
		});
	});

	describe("getSuggestedGuardrails", () => {
		test("returns empty array when no patterns meet threshold", () => {
			recordFailure({ error: "Error", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error", output: "", taskTitle: "Task", exitCode: 1, iteration: 2 });
			const suggestions = getSuggestedGuardrails();

			expect(suggestions).toEqual([]);
		});

		test("generates suggestions for patterns with 3+ occurrences", () => {
			for (let index = 0; index < 3; index++) {
				recordFailure({
					error: "Build failed: same error",
					output: "",
					taskTitle: "Task",
					exitCode: 1,
					iteration: index + 1,
				});
			}

			const suggestions = getSuggestedGuardrails();

			expect(suggestions.length).toBeGreaterThan(0);
			expect(suggestions[0]?.enabled).toBe(false);
			expect(suggestions[0]?.instruction).toBeDefined();
		});

		test("includes pattern information in addedAfterFailure", () => {
			for (let index = 0; index < 3; index++) {
				recordFailure({
					error: "Test error pattern",
					output: "",
					taskTitle: "Task",
					exitCode: 1,
					iteration: index + 1,
				});
			}

			const suggestions = getSuggestedGuardrails();

			if (suggestions.length > 0) {
				expect(suggestions[0]?.addedAfterFailure).toContain("Pattern detected");
			}
		});
	});

	describe("generatePatternReport", () => {
		test("generates report with zero failures", () => {
			const report = generatePatternReport();

			expect(report.totalFailures).toBe(0);
			expect(report.uniquePatterns).toBe(0);
			expect(report.topPatterns).toEqual([]);
			expect(report.taskFailureRates).toEqual([]);
			expect(report.categoryBreakdown).toEqual([]);
			expect(report.suggestedGuardrails).toEqual([]);
		});

		test("calculates total failures correctly", () => {
			recordFailure({ error: "Error 1", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error 2", output: "", taskTitle: "Task", exitCode: 1, iteration: 2 });
			const report = generatePatternReport();

			expect(report.totalFailures).toBe(2);
		});

		test("tracks task failure rates", () => {
			recordFailure({ error: "Error", output: "", taskTitle: "Task A", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error", output: "", taskTitle: "Task A", exitCode: 1, iteration: 2 });
			recordFailure({ error: "Error", output: "", taskTitle: "Task B", exitCode: 1, iteration: 3 });
			const report = generatePatternReport();

			expect(report.taskFailureRates.length).toBeGreaterThan(0);
			const taskA = report.taskFailureRates.find((task) => task.task === "Task A");

			expect(taskA?.failures).toBe(2);
		});

		test("calculates category breakdown", () => {
			recordFailure({
				error: "Build failed",
				output: "",
				taskTitle: "Task",
				exitCode: null,
				iteration: 1,
			});
			recordFailure({
				error: "Test failed",
				output: "",
				taskTitle: "Task",
				exitCode: null,
				iteration: 2,
			});
			const report = generatePatternReport();

			expect(report.categoryBreakdown.length).toBeGreaterThan(0);
			const buildCategory = report.categoryBreakdown.find(
				(cat) => cat.category === "build_failure",
			);

			expect(buildCategory?.count).toBe(1);
		});

		test("includes recommendations", () => {
			for (let index = 0; index < 5; index++) {
				recordFailure({
					error: "Build failed",
					output: "",
					taskTitle: "Task",
					exitCode: null,
					iteration: index + 1,
				});
			}

			const report = generatePatternReport();

			expect(report.recommendations.length).toBeGreaterThan(0);
		});
	});

	describe("formatPatternReport", () => {
		test("formats empty report", () => {
			const report = generatePatternReport();
			const formatted = formatPatternReport(report);

			expect(formatted).toContain("Total Failures: 0");
			expect(formatted).toContain("Unique Patterns: 0");
		});

		test("includes category breakdown", () => {
			recordFailure({
				error: "Build failed",
				output: "",
				taskTitle: "Task",
				exitCode: null,
				iteration: 1,
			});
			const report = generatePatternReport();
			const formatted = formatPatternReport(report);

			expect(formatted).toContain("Category Breakdown");
		});

		test("includes top patterns", () => {
			for (let index = 0; index < 3; index++) {
				recordFailure({
					error: "Same error",
					output: "",
					taskTitle: "Task",
					exitCode: 1,
					iteration: index + 1,
				});
			}

			const report = generatePatternReport();
			const formatted = formatPatternReport(report);

			expect(formatted).toContain("Top Failure Patterns");
		});

		test("includes recommendations section", () => {
			const report = generatePatternReport();
			const formatted = formatPatternReport(report);

			if (report.recommendations.length > 0) {
				expect(formatted).toContain("Recommendations");
			}
		});
	});

	describe("clearFailureHistory", () => {
		test("clears all failure history", () => {
			recordFailure({ error: "Error", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			expect(loadFailureHistory().entries.length).toBeGreaterThan(0);

			clearFailureHistory();
			const history = loadFailureHistory();

			expect(history.entries).toEqual([]);
			expect(history.patterns).toEqual([]);
		});
	});

	describe("getFailureHistoryStats", () => {
		test("returns zero stats when history is empty", () => {
			const stats = getFailureHistoryStats();

			expect(stats.totalEntries).toBe(0);
			expect(stats.oldestEntry).toBeNull();
			expect(stats.newestEntry).toBeNull();
		});

		test("returns correct stats for populated history", () => {
			recordFailure({ error: "Error 1", output: "", taskTitle: "Task", exitCode: 1, iteration: 1 });
			recordFailure({ error: "Error 2", output: "", taskTitle: "Task", exitCode: 1, iteration: 2 });
			const stats = getFailureHistoryStats();

			expect(stats.totalEntries).toBe(2);
			expect(stats.oldestEntry).not.toBeNull();
			expect(stats.newestEntry).not.toBeNull();
		});
	});
});
