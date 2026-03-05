import { describe, expect, test } from "bun:test";
import { generateStatisticsReport } from "@/lib/statistics.ts";
import type { SessionStatistics } from "@/types.ts";

describe("generateStatisticsReport", () => {
  test("generates report with all statistics", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 450_000,
      completedIterations: 8,
      failedIterations: 1,
      iterationTimings: [],
      successRate: 87.5,
      successfulIterations: 7,
      totalDurationMs: 3_600_000,
      totalIterations: 10,
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
      averageDurationMs: 7_265_000,
      completedIterations: 1,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 100,
      successfulIterations: 1,
      totalDurationMs: 7_265_000,
      totalIterations: 1,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).toContain("2h 1m 5s");
  });

  test("formats duration correctly for minutes", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 125_000,
      completedIterations: 1,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 100,
      successfulIterations: 1,
      totalDurationMs: 125_000,
      totalIterations: 1,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).toContain("2m 5s");
  });

  test("formats duration correctly for seconds only", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 45_000,
      completedIterations: 1,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 100,
      successfulIterations: 1,
      totalDurationMs: 45_000,
      totalIterations: 1,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).toContain("45s");
  });

  test("includes iteration timings when provided", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 60_000,
      completedIterations: 3,
      failedIterations: 0,
      iterationTimings: [
        { durationMs: 60000, endTime: 60000, iteration: 1, startTime: 0 },
        { durationMs: 60000, endTime: 120000, iteration: 2, startTime: 60000 },
        { durationMs: 60000, endTime: 180000, iteration: 3, startTime: 120000 },
      ],
      successRate: 100,
      successfulIterations: 3,
      totalDurationMs: 180_000,
      totalIterations: 3,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).toContain("Iteration Timings:");
    expect(report).toContain("Iteration 1: 1m 0s");
    expect(report).toContain("Iteration 2: 1m 0s");
    expect(report).toContain("Iteration 3: 1m 0s");
  });

  test("handles zero values gracefully", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 0,
      completedIterations: 0,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations: 0,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).toContain("Total Iterations: 0");
    expect(report).toContain("Success Rate: 0.0%");
    expect(report).toContain("Total Duration: 0s");
  });

  test("skips iteration timings section when empty", () => {
    const statistics: SessionStatistics = {
      averageDurationMs: 60_000,
      completedIterations: 1,
      failedIterations: 0,
      iterationTimings: [],
      successRate: 100,
      successfulIterations: 1,
      totalDurationMs: 60_000,
      totalIterations: 1,
    };

    const report = generateStatisticsReport(statistics);

    expect(report).not.toContain("Iteration Timings:");
  });
});
