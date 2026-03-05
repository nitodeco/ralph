import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import type {
  TechnicalDebtConfig,
  TechnicalDebtReport,
} from "@/lib/handlers/TechnicalDebtHandler.ts";
import {
  TechnicalDebtHandler,
  formatTechnicalDebtReport,
} from "@/lib/handlers/TechnicalDebtHandler.ts";
import type { IterationLog, SessionStatistics } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-technical-debt-handler";

function createMockStatistics(overrides: Partial<SessionStatistics> = {}): SessionStatistics {
  return {
    averageDurationMs: 6000,
    completedIterations: 10,
    failedIterations: 2,
    iterationTimings: [],
    successRate: 80,
    successfulIterations: 8,
    totalDurationMs: 60_000,
    totalIterations: 10,
    ...overrides,
  };
}

function createMockIterationLog(
  iteration: number,
  overrides: Partial<IterationLog> = {},
): IterationLog {
  return {
    agent: {
      exitCode: 0,
      outputLength: 1000,
      retryCount: 0,
      type: "cursor",
    },
    completedAt: new Date().toISOString(),
    durationMs: 6000,
    errors: [],
    iteration,
    startedAt: new Date().toISOString(),
    status: "completed",
    task: { index: iteration - 1, title: `Task ${iteration}`, wasCompleted: true },
    totalIterations: 10,
    ...overrides,
  };
}

describe("TechnicalDebtHandler", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }

    mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("basic functionality", () => {
    test("tracks handler state and report", () => {
      const stateChanges: {
        isReviewing: boolean;
        report: TechnicalDebtReport | null;
      }[] = [];

      const handler = new TechnicalDebtHandler({
        onStateChange: (isReviewing, report) => {
          stateChanges.push({ isReviewing, report });
        },
      });

      const logs: IterationLog[] = [createMockIterationLog(1)];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      expect(report.sessionId).toBe("test-session");
      expect(handler.getLastReport()?.sessionId).toBe("test-session");
      expect(handler.getIsRunning()).toBe(false);
      expect(stateChanges.length).toBe(2);
      expect(stateChanges.at(0)).toEqual({ isReviewing: true, report: null });
      expect(stateChanges.at(1)?.isReviewing).toBe(false);
      expect(stateChanges.at(1)?.report?.sessionId).toBe("test-session");
    });

    test("resets handler state", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1)];
      const statistics = createMockStatistics();

      handler.run("test-session", logs, statistics);

      expect(handler.getLastReport()).not.toBeNull();

      handler.reset();

      expect(handler.getLastReport()).toBeNull();
      expect(handler.getIsRunning()).toBe(false);
    });
  });

  describe("retry pattern analysis", () => {
    test("detects high retry patterns as critical", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          agent: {
            exitCode: 0,
            outputLength: 1000,
            retryContexts: [
              {
                attemptNumber: 1,
                contextInjected: "Fix build",
                failureCategory: "tooling",
                rootCause: "Build error",
              },
              {
                attemptNumber: 2,
                contextInjected: "Fix build",
                failureCategory: "tooling",
                rootCause: "Build error",
              },
              {
                attemptNumber: 3,
                contextInjected: "Fix build",
                failureCategory: "tooling",
                rootCause: "Build error",
              },
            ],
            retryCount: 3,
            type: "cursor",
          },
        }),
      ];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      const retryItems = report.items.filter((item) => item.category === "retry_patterns");

      expect(retryItems.length).toBeGreaterThan(0);

      const highSeverityItem = retryItems.find(
        (item) => item.severity === "critical" || item.severity === "high",
      );

      expect(highSeverityItem).toBeDefined();
      expect(highSeverityItem?.title).toContain("tooling");
    });

    test("detects medium retry patterns", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          agent: {
            exitCode: 0,
            outputLength: 1000,
            retryCount: 2,
            type: "cursor",
          },
        }),
        createMockIterationLog(2, {
          agent: {
            exitCode: 0,
            outputLength: 1000,
            retryCount: 2,
            type: "cursor",
          },
        }),
      ];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      const mediumRetryItems = report.items.filter(
        (item) => item.category === "retry_patterns" && item.severity === "medium",
      );

      expect(mediumRetryItems.length).toBeGreaterThan(0);
    });
  });

  describe("verification failure analysis", () => {
    test("detects recurring verification failures", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          status: "verification_failed",
          verification: {
            checks: [{ durationMs: 1000, name: "lint", passed: false }],
            failedChecks: ["lint"],
            passed: false,
            ran: true,
            totalDurationMs: 1000,
          },
        }),
        createMockIterationLog(2, {
          status: "verification_failed",
          verification: {
            checks: [{ durationMs: 1000, name: "lint", passed: false }],
            failedChecks: ["lint"],
            passed: false,
            ran: true,
            totalDurationMs: 1000,
          },
        }),
        createMockIterationLog(3, {
          status: "verification_failed",
          verification: {
            checks: [{ durationMs: 1000, name: "lint", passed: false }],
            failedChecks: ["lint"],
            passed: false,
            ran: true,
            totalDurationMs: 1000,
          },
        }),
      ];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      const verificationItems = report.items.filter(
        (item) => item.category === "verification_failures",
      );

      expect(verificationItems.length).toBeGreaterThan(0);

      const lintItem = verificationItems.find((item) => item.title.includes("lint"));

      expect(lintItem).toBeDefined();
      expect(lintItem?.occurrences).toBe(3);
    });
  });

  describe("decomposition analysis", () => {
    test("detects high decomposition frequency", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          decomposition: {
            originalTaskTitle: "Task 1",
            reason: "Too complex",
            subtasksCreated: ["Subtask 1", "Subtask 2"],
          },
          status: "decomposed",
        }),
        createMockIterationLog(2, {
          decomposition: {
            originalTaskTitle: "Task 2",
            reason: "Too complex",
            subtasksCreated: ["Subtask 3", "Subtask 4"],
          },
          status: "decomposed",
        }),
      ];
      const statistics = createMockStatistics({ totalIterations: 4 });
      const report = handler.run("test-session", logs, statistics);

      const decompositionItems = report.items.filter(
        (item) => item.category === "decomposition_frequency",
      );

      expect(decompositionItems.length).toBeGreaterThan(0);

      const item = decompositionItems.at(0);

      expect(item?.occurrences).toBe(2);
    });
  });

  describe("error pattern analysis", () => {
    test("detects recurring error patterns", () => {
      const handler = new TechnicalDebtHandler();
      const timestamp = new Date().toISOString();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          errors: [{ message: "Connection timeout error", timestamp }],
        }),
        createMockIterationLog(2, {
          errors: [{ message: "Connection timeout error", timestamp }],
        }),
      ];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      const errorItems = report.items.filter((item) => item.category === "error_patterns");

      expect(errorItems.length).toBeGreaterThan(0);
      expect(errorItems.at(0)?.occurrences).toBe(2);
    });
  });

  describe("performance analysis", () => {
    test("detects slow iterations", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, { durationMs: 6000 }),
        createMockIterationLog(2, { durationMs: 6000 }),
        createMockIterationLog(3, { durationMs: 15_000 }),
        createMockIterationLog(4, { durationMs: 15_000 }),
      ];
      const statistics = createMockStatistics({
        averageDurationMs: 6000,
      });
      const report = handler.run("test-session", logs, statistics);

      const performanceItems = report.items.filter(
        (item) => item.category === "performance" && item.title.includes("Slow iterations"),
      );

      expect(performanceItems.length).toBeGreaterThan(0);
    });

    test("detects low success rate", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, { status: "failed" }),
        createMockIterationLog(2, { status: "failed" }),
        createMockIterationLog(3, { status: "failed" }),
      ];
      const statistics = createMockStatistics({
        failedIterations: 6,
        successRate: 40,
      });
      const report = handler.run("test-session", logs, statistics);

      const processItems = report.items.filter(
        (item) => item.category === "process" && item.title.includes("Low overall success rate"),
      );

      expect(processItems.length).toBeGreaterThan(0);

      const item = processItems.at(0);

      expect(item?.severity).toBe("critical");
    });
  });

  describe("configuration", () => {
    test("respects minSeverity configuration", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          agent: {
            exitCode: 0,
            outputLength: 1000,
            retryCount: 2,
            type: "cursor",
          },
        }),
      ];
      const statistics = createMockStatistics({ successRate: 95 });
      const config: TechnicalDebtConfig = {
        minSeverity: "high",
      };
      const report = handler.run("test-session", logs, statistics, config);

      const lowMediumItems = report.items.filter(
        (item) => item.severity === "low" || item.severity === "medium",
      );

      expect(lowMediumItems.length).toBe(0);
    });

    test("can disable specific analysis", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, {
          agent: {
            exitCode: 0,
            outputLength: 1000,
            retryContexts: [
              {
                attemptNumber: 1,
                contextInjected: "Fix build",
                failureCategory: "tooling",
                rootCause: "Build error",
              },
            ],
            retryCount: 3,
            type: "cursor",
          },
        }),
      ];
      const statistics = createMockStatistics();
      const config: TechnicalDebtConfig = {
        analyzeRetryPatterns: false,
      };
      const report = handler.run("test-session", logs, statistics, config);

      const retryItems = report.items.filter((item) => item.category === "retry_patterns");

      expect(retryItems.length).toBe(0);
    });
  });

  describe("report generation", () => {
    test("generates summary for empty items", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1)];
      const statistics = createMockStatistics({ successRate: 100 });
      const report = handler.run("test-session", logs, statistics);

      expect(report.summary).toContain("No significant technical debt");
    });

    test("generates summary with item counts", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, { status: "failed" }),
        createMockIterationLog(2, { status: "failed" }),
        createMockIterationLog(3, { status: "failed" }),
      ];
      const statistics = createMockStatistics({
        failedIterations: 7,
        successRate: 30,
      });
      const report = handler.run("test-session", logs, statistics);

      expect(report.summary).toContain("Found");
      expect(report.summary).toContain("technical debt items");
    });

    test("generates recommendations for critical items", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1, { status: "failed" })];
      const statistics = createMockStatistics({
        failedIterations: 7,
        successRate: 30,
      });
      const report = handler.run("test-session", logs, statistics);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some((rec) => rec.includes("[CRITICAL]"))).toBe(true);
    });

    test("counts items by severity", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [
        createMockIterationLog(1, { status: "failed" }),
        createMockIterationLog(2, { status: "failed" }),
      ];
      const statistics = createMockStatistics({
        failedIterations: 5,
        successRate: 45,
      });
      const report = handler.run("test-session", logs, statistics);

      expect(report.itemsBySeverity.critical).toBeGreaterThanOrEqual(0);
      expect(report.itemsBySeverity.high).toBeGreaterThanOrEqual(0);
      expect(report.itemsBySeverity.medium).toBeGreaterThanOrEqual(0);
      expect(report.itemsBySeverity.low).toBeGreaterThanOrEqual(0);
    });

    test("counts items by category", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1)];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      expect(report.itemsByCategory.retry_patterns).toBeGreaterThanOrEqual(0);
      expect(report.itemsByCategory.verification_failures).toBeGreaterThanOrEqual(0);
      expect(report.itemsByCategory.decomposition_frequency).toBeGreaterThanOrEqual(0);
      expect(report.itemsByCategory.error_patterns).toBeGreaterThanOrEqual(0);
      expect(report.itemsByCategory.performance).toBeGreaterThanOrEqual(0);
      expect(report.itemsByCategory.process).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatTechnicalDebtReport", () => {
    test("formats empty report", () => {
      const report: TechnicalDebtReport = {
        analyzedAt: new Date().toISOString(),
        items: [],
        itemsByCategory: {
          decomposition_frequency: 0,
          error_patterns: 0,
          performance: 0,
          process: 0,
          retry_patterns: 0,
          verification_failures: 0,
        },
        itemsBySeverity: { critical: 0, high: 0, low: 0, medium: 0 },
        recommendations: [],
        sessionId: "test-session",
        summary: "No significant technical debt detected in this session.",
        totalItems: 0,
      };

      const formatted = formatTechnicalDebtReport(report);

      expect(formatted).toContain("=== Technical Debt Review ===");
      expect(formatted).toContain("No significant technical debt");
    });

    test("formats report with items", () => {
      const report: TechnicalDebtReport = {
        analyzedAt: new Date().toISOString(),
        items: [
          {
            affectedIterations: [1, 2, 3, 4, 5, 6, 7],
            category: "process",
            description: "Session success rate of 30% is very low",
            id: "process-0",
            occurrences: 7,
            severity: "critical",
            suggestedAction: "Review PRD and task definitions",
            title: "Low success rate",
          },
          {
            affectedIterations: [1, 2, 3],
            category: "retry_patterns",
            description: "5 retry attempts due to build errors",
            id: "retry_patterns-0",
            occurrences: 5,
            severity: "high",
            suggestedAction: "Investigate build configuration",
            title: "Recurring build failures",
          },
        ],
        itemsByCategory: {
          decomposition_frequency: 0,
          error_patterns: 0,
          performance: 0,
          process: 1,
          retry_patterns: 1,
          verification_failures: 0,
        },
        itemsBySeverity: { critical: 1, high: 1, low: 0, medium: 0 },
        recommendations: [
          "[CRITICAL] Review PRD and task definitions",
          "[HIGH] Investigate build configuration",
        ],
        sessionId: "test-session",
        summary: "Found 2 technical debt items: 1 critical, 1 high",
        totalItems: 2,
      };

      const formatted = formatTechnicalDebtReport(report);

      expect(formatted).toContain("=== Technical Debt Review ===");
      expect(formatted).toContain("Critical: 1");
      expect(formatted).toContain("High: 1");
      expect(formatted).toContain("[CRITICAL] Low success rate");
      expect(formatted).toContain("[HIGH] Recurring build failures");
      expect(formatted).toContain("Recommendations:");
    });
  });

  describe("edge cases", () => {
    test("handles empty logs", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [];
      const statistics = createMockStatistics({ completedIterations: 0 });
      const report = handler.run("test-session", logs, statistics);

      expect(report.totalItems).toBe(0);
      expect(report.summary).toContain("No significant technical debt");
    });

    test("handles logs with null duration", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1, { durationMs: null })];
      const statistics = createMockStatistics({ averageDurationMs: 0 });
      const report = handler.run("test-session", logs, statistics);

      expect(report).toBeDefined();
    });

    test("works without state callback", () => {
      const handler = new TechnicalDebtHandler();
      const logs: IterationLog[] = [createMockIterationLog(1)];
      const statistics = createMockStatistics();
      const report = handler.run("test-session", logs, statistics);

      expect(report).toBeDefined();
      expect(report.sessionId).toBe("test-session");
    });
  });
});
