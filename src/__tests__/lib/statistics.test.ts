import { describe, expect, test } from "bun:test";
import { generateStatisticsReport } from "@/lib/statistics.ts";
import type { SessionStatistics } from "@/types.ts";

describe("generateStatisticsReport", () => {
	test("generates report with all statistics", () => {
		const statistics: SessionStatistics = {
			totalIterations: 10,
			completedIterations: 8,
			successfulIterations: 7,
			failedIterations: 1,
			totalDurationMs: 3600000,
			averageDurationMs: 450000,
			successRate: 87.5,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);

		expect(report).toContain("=== Session Statistics ===");
		expect(report).toContain("Total Iterations: 10");
		expect(report).toContain("Completed Iterations: 8");
		expect(report).toContain("Successful Iterations: 7");
		expect(report).toContain("Failed Iterations: 1");
		expect(report).toContain("Success Rate: 87.5%");
		expect(report).toContain("Total Duration: 1h 0m 0s");
		expect(report).toContain("Average Iteration Duration: 7m 30s");
	});

	test("formats duration correctly for hours", () => {
		const statistics: SessionStatistics = {
			totalIterations: 1,
			completedIterations: 1,
			successfulIterations: 1,
			failedIterations: 0,
			totalDurationMs: 7265000,
			averageDurationMs: 7265000,
			successRate: 100,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).toContain("2h 1m 5s");
	});

	test("formats duration correctly for minutes", () => {
		const statistics: SessionStatistics = {
			totalIterations: 1,
			completedIterations: 1,
			successfulIterations: 1,
			failedIterations: 0,
			totalDurationMs: 125000,
			averageDurationMs: 125000,
			successRate: 100,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).toContain("2m 5s");
	});

	test("formats duration correctly for seconds only", () => {
		const statistics: SessionStatistics = {
			totalIterations: 1,
			completedIterations: 1,
			successfulIterations: 1,
			failedIterations: 0,
			totalDurationMs: 45000,
			averageDurationMs: 45000,
			successRate: 100,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).toContain("45s");
	});

	test("includes iteration timings when provided", () => {
		const statistics: SessionStatistics = {
			totalIterations: 3,
			completedIterations: 3,
			successfulIterations: 3,
			failedIterations: 0,
			totalDurationMs: 180000,
			averageDurationMs: 60000,
			successRate: 100,
			iterationTimings: [
				{ iteration: 1, startTime: 0, endTime: 60000, durationMs: 60000 },
				{ iteration: 2, startTime: 60000, endTime: 120000, durationMs: 60000 },
				{ iteration: 3, startTime: 120000, endTime: 180000, durationMs: 60000 },
			],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).toContain("Iteration Timings:");
		expect(report).toContain("Iteration 1: 1m 0s");
		expect(report).toContain("Iteration 2: 1m 0s");
		expect(report).toContain("Iteration 3: 1m 0s");
	});

	test("handles zero values gracefully", () => {
		const statistics: SessionStatistics = {
			totalIterations: 0,
			completedIterations: 0,
			successfulIterations: 0,
			failedIterations: 0,
			totalDurationMs: 0,
			averageDurationMs: 0,
			successRate: 0,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).toContain("Total Iterations: 0");
		expect(report).toContain("Success Rate: 0.0%");
		expect(report).toContain("Total Duration: 0s");
	});

	test("skips iteration timings section when empty", () => {
		const statistics: SessionStatistics = {
			totalIterations: 1,
			completedIterations: 1,
			successfulIterations: 1,
			failedIterations: 0,
			totalDurationMs: 60000,
			averageDurationMs: 60000,
			successRate: 100,
			iterationTimings: [],
		};

		const report = generateStatisticsReport(statistics);
		expect(report).not.toContain("Iteration Timings:");
	});
});
