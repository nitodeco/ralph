import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";
import { createUsageStatisticsService } from "@/lib/services/usage-statistics/implementation.ts";
import type { UsageStatistics } from "@/lib/services/usage-statistics/types.ts";
import {
	isDailyUsage,
	isSessionRecord,
	isUsageStatistics,
} from "@/lib/services/usage-statistics/validation.ts";

const TEST_DIR = join(tmpdir(), `ralph-test-usage-statistics-${Date.now()}`);
const TEST_RALPH_DIR = join(TEST_DIR, ".ralph");
const TEST_PROJECTS_DIR = join(TEST_RALPH_DIR, "projects");
const TEST_PROJECT_DIR = join(TEST_PROJECTS_DIR, "test-project");

function getTestConfig(): ProjectRegistryConfig {
	return {
		globalDir: TEST_RALPH_DIR,
		registryPath: join(TEST_RALPH_DIR, "registry.json"),
		projectsDir: TEST_PROJECTS_DIR,
	};
}

const ORIGINAL_CWD = process.cwd();

describe("UsageStatisticsService", () => {
	let usageStatisticsService: ReturnType<typeof createUsageStatisticsService>;

	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}

		mkdirSync(TEST_PROJECT_DIR, { recursive: true });

		const registry = {
			version: 1,
			projects: {
				"test-project": {
					identifier: { type: "custom", value: "test-project", folderName: "test-project" },
					displayName: "Test Project",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					lastKnownPath: TEST_DIR,
				},
			},
			pathCache: { [TEST_DIR]: "test-project" },
		};

		writeFileSync(join(TEST_RALPH_DIR, "registry.json"), JSON.stringify(registry));

		const projectRegistryService = createProjectRegistryService(getTestConfig());

		bootstrapTestServices({
			projectRegistry: projectRegistryService,
		});

		process.chdir(TEST_DIR);
		usageStatisticsService = createUsageStatisticsService();
	});

	afterEach(() => {
		try {
			process.chdir(ORIGINAL_CWD);
		} catch {
			// Ignore if directory doesn't exist
		}

		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("initialize", () => {
		test("creates empty statistics with correct project name", () => {
			const statistics = usageStatisticsService.initialize("My Test Project");

			expect(statistics.projectName).toBe("My Test Project");
			expect(statistics.version).toBe(1);
			expect(statistics.lifetime.totalSessions).toBe(0);
			expect(statistics.lifetime.totalIterations).toBe(0);
			expect(statistics.recentSessions).toEqual([]);
			expect(statistics.dailyUsage).toEqual([]);
		});

		test("returns existing statistics if file exists", () => {
			usageStatisticsService.initialize("First Project");
			usageStatisticsService.recordSession({
				sessionId: "test-session-1",
				startedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				durationMs: 60_000,
				totalIterations: 5,
				completedIterations: 4,
				successfulIterations: 3,
				failedIterations: 1,
				tasksCompleted: 2,
				tasksAttempted: 3,
				status: "completed",
			});

			const secondInit = usageStatisticsService.initialize("Different Project");

			expect(secondInit.lifetime.totalSessions).toBe(1);
		});
	});

	describe("recordSession", () => {
		test("records a session and updates lifetime statistics", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.lifetime.totalSessions).toBe(1);
			expect(statistics.lifetime.totalIterations).toBe(8);
			expect(statistics.lifetime.successfulIterations).toBe(6);
			expect(statistics.lifetime.failedIterations).toBe(2);
			expect(statistics.lifetime.totalTasksCompleted).toBe(3);
			expect(statistics.lifetime.totalTasksAttempted).toBe(4);
			expect(statistics.lifetime.totalDurationMs).toBe(1_800_000);
		});

		test("adds session to recentSessions list", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.recentSessions).toHaveLength(1);
			expect(statistics.recentSessions.at(0)?.id).toBe("session-1");
			expect(statistics.recentSessions.at(0)?.status).toBe("completed");
		});

		test("updates daily usage", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.dailyUsage).toHaveLength(1);
			expect(statistics.dailyUsage.at(0)?.date).toBe("2025-01-20");
			expect(statistics.dailyUsage.at(0)?.sessionsStarted).toBe(1);
			expect(statistics.dailyUsage.at(0)?.iterationsRun).toBe(8);
			expect(statistics.dailyUsage.at(0)?.tasksCompleted).toBe(3);
		});

		test("accumulates daily usage for same day", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_000_000,
				totalIterations: 5,
				completedIterations: 4,
				successfulIterations: 3,
				failedIterations: 1,
				tasksCompleted: 2,
				tasksAttempted: 2,
				status: "completed",
			});

			usageStatisticsService.recordSession({
				sessionId: "session-2",
				startedAt: "2025-01-20T14:00:00.000Z",
				completedAt: "2025-01-20T15:00:00.000Z",
				durationMs: 2_000_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 7,
				failedIterations: 1,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.dailyUsage).toHaveLength(1);
			expect(statistics.dailyUsage.at(0)?.sessionsStarted).toBe(2);
			expect(statistics.dailyUsage.at(0)?.iterationsRun).toBe(12);
			expect(statistics.dailyUsage.at(0)?.tasksCompleted).toBe(5);
			expect(statistics.dailyUsage.at(0)?.totalDurationMs).toBe(3_000_000);
		});

		test("calculates averages correctly", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_000_000,
				totalIterations: 10,
				completedIterations: 10,
				successfulIterations: 8,
				failedIterations: 2,
				tasksCompleted: 4,
				tasksAttempted: 5,
				status: "completed",
			});

			usageStatisticsService.recordSession({
				sessionId: "session-2",
				startedAt: "2025-01-21T10:00:00.000Z",
				completedAt: "2025-01-21T10:30:00.000Z",
				durationMs: 2_000_000,
				totalIterations: 20,
				completedIterations: 20,
				successfulIterations: 16,
				failedIterations: 4,
				tasksCompleted: 6,
				tasksAttempted: 7,
				status: "completed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.lifetime.totalSessions).toBe(2);
			expect(statistics.lifetime.averageIterationsPerSession).toBe(15);
			expect(statistics.lifetime.averageTasksPerSession).toBe(5);
			expect(statistics.lifetime.averageSessionDurationMs).toBe(1_500_000);
			expect(statistics.lifetime.overallSuccessRate).toBe(80);
		});

		test("handles stopped sessions", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:15:00.000Z",
				durationMs: 900_000,
				totalIterations: 10,
				completedIterations: 5,
				successfulIterations: 3,
				failedIterations: 2,
				tasksCompleted: 1,
				tasksAttempted: 2,
				status: "stopped",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.recentSessions.at(0)?.status).toBe("stopped");
		});

		test("handles failed sessions", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:05:00.000Z",
				durationMs: 300_000,
				totalIterations: 10,
				completedIterations: 2,
				successfulIterations: 0,
				failedIterations: 2,
				tasksCompleted: 0,
				tasksAttempted: 1,
				status: "failed",
			});

			const statistics = usageStatisticsService.get();

			expect(statistics.recentSessions.at(0)?.status).toBe("failed");
		});
	});

	describe("getSummary", () => {
		test("returns summary with correct values", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const summary = usageStatisticsService.getSummary();

			expect(summary.totalSessions).toBe(1);
			expect(summary.totalIterations).toBe(8);
			expect(summary.totalTasksCompleted).toBe(3);
			expect(summary.totalDurationMs).toBe(1_800_000);
			expect(summary.overallSuccessRate).toBe(75);
			expect(summary.lastSessionAt).toBe("2025-01-20T10:00:00.000Z");
		});

		test("returns null lastSessionAt when no sessions", () => {
			usageStatisticsService.initialize("Test Project");

			const summary = usageStatisticsService.getSummary();

			expect(summary.lastSessionAt).toBeNull();
		});
	});

	describe("getRecentSessions", () => {
		test("returns limited number of sessions", () => {
			usageStatisticsService.initialize("Test Project");

			for (let sessionIndex = 0; sessionIndex < 15; sessionIndex++) {
				usageStatisticsService.recordSession({
					sessionId: `session-${sessionIndex}`,
					startedAt: new Date(Date.now() - (15 - sessionIndex) * 86_400_000).toISOString(),
					completedAt: new Date(
						Date.now() - (15 - sessionIndex) * 86_400_000 + 3_600_000,
					).toISOString(),
					durationMs: 3_600_000,
					totalIterations: 5,
					completedIterations: 5,
					successfulIterations: 4,
					failedIterations: 1,
					tasksCompleted: 2,
					tasksAttempted: 2,
					status: "completed",
				});
			}

			const recentSessions = usageStatisticsService.getRecentSessions(5);

			expect(recentSessions).toHaveLength(5);
		});

		test("returns all sessions when limit exceeds count", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: new Date().toISOString(),
				completedAt: new Date().toISOString(),
				durationMs: 1_000_000,
				totalIterations: 5,
				completedIterations: 5,
				successfulIterations: 4,
				failedIterations: 1,
				tasksCompleted: 2,
				tasksAttempted: 2,
				status: "completed",
			});

			const recentSessions = usageStatisticsService.getRecentSessions(10);

			expect(recentSessions).toHaveLength(1);
		});
	});

	describe("getDailyUsage", () => {
		test("returns limited number of days", () => {
			usageStatisticsService.initialize("Test Project");

			for (let dayIndex = 0; dayIndex < 10; dayIndex++) {
				usageStatisticsService.recordSession({
					sessionId: `session-${dayIndex}`,
					startedAt: new Date(Date.now() - dayIndex * 86_400_000).toISOString(),
					completedAt: new Date(Date.now() - dayIndex * 86_400_000 + 3_600_000).toISOString(),
					durationMs: 3_600_000,
					totalIterations: 5,
					completedIterations: 5,
					successfulIterations: 4,
					failedIterations: 1,
					tasksCompleted: 2,
					tasksAttempted: 2,
					status: "completed",
				});
			}

			const dailyUsage = usageStatisticsService.getDailyUsage(5);

			expect(dailyUsage).toHaveLength(5);
		});
	});

	describe("exists", () => {
		test("returns false when file does not exist", () => {
			expect(usageStatisticsService.exists()).toBe(false);
		});

		test("returns true after initialization", () => {
			usageStatisticsService.initialize("Test Project");

			expect(usageStatisticsService.exists()).toBe(true);
		});
	});

	describe("save and load", () => {
		test("persists and loads statistics correctly", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			usageStatisticsService.invalidate();

			const loaded = usageStatisticsService.get();

			expect(loaded.lifetime.totalSessions).toBe(1);
			expect(loaded.lifetime.totalIterations).toBe(8);
			expect(loaded.recentSessions).toHaveLength(1);
		});

		test("handles corrupted JSON gracefully", () => {
			const statsPath = join(TEST_PROJECT_DIR, "usage-statistics.json");

			writeFileSync(statsPath, "{ invalid json }");

			const loaded = usageStatisticsService.load();

			expect(loaded.lifetime.totalSessions).toBe(0);
		});
	});

	describe("formatForDisplay", () => {
		test("returns formatted string with statistics", () => {
			usageStatisticsService.initialize("Test Project");

			usageStatisticsService.recordSession({
				sessionId: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			});

			const display = usageStatisticsService.formatForDisplay();

			expect(display).toContain("Usage Statistics");
			expect(display).toContain("Total Sessions: 1");
			expect(display).toContain("Total Iterations: 8");
			expect(display).toContain("Tasks Completed: 3");
		});
	});

	describe("max limits", () => {
		test("limits recent sessions to MAX_RECENT_SESSIONS", () => {
			usageStatisticsService.initialize("Test Project");

			for (let sessionIndex = 0; sessionIndex < 60; sessionIndex++) {
				usageStatisticsService.recordSession({
					sessionId: `session-${sessionIndex}`,
					startedAt: new Date(Date.now() - (60 - sessionIndex) * 86_400_000).toISOString(),
					completedAt: new Date(
						Date.now() - (60 - sessionIndex) * 86_400_000 + 3_600_000,
					).toISOString(),
					durationMs: 3_600_000,
					totalIterations: 5,
					completedIterations: 5,
					successfulIterations: 4,
					failedIterations: 1,
					tasksCompleted: 2,
					tasksAttempted: 2,
					status: "completed",
				});
			}

			const statistics = usageStatisticsService.get();

			expect(statistics.recentSessions.length).toBeLessThanOrEqual(50);
		});

		test("limits daily usage to MAX_DAILY_USAGE_DAYS", () => {
			usageStatisticsService.initialize("Test Project");

			for (let dayIndex = 0; dayIndex < 100; dayIndex++) {
				usageStatisticsService.recordSession({
					sessionId: `session-${dayIndex}`,
					startedAt: new Date(Date.now() - dayIndex * 86_400_000).toISOString(),
					completedAt: new Date(Date.now() - dayIndex * 86_400_000 + 3_600_000).toISOString(),
					durationMs: 3_600_000,
					totalIterations: 5,
					completedIterations: 5,
					successfulIterations: 4,
					failedIterations: 1,
					tasksCompleted: 2,
					tasksAttempted: 2,
					status: "completed",
				});
			}

			const statistics = usageStatisticsService.get();

			expect(statistics.dailyUsage.length).toBeLessThanOrEqual(90);
		});
	});
});

describe("validation functions", () => {
	describe("isSessionRecord", () => {
		test("returns true for valid session record", () => {
			const record = {
				id: "session-1",
				startedAt: "2025-01-20T10:00:00.000Z",
				completedAt: "2025-01-20T10:30:00.000Z",
				durationMs: 1_800_000,
				totalIterations: 10,
				completedIterations: 8,
				successfulIterations: 6,
				failedIterations: 2,
				tasksCompleted: 3,
				tasksAttempted: 4,
				status: "completed",
			};

			expect(isSessionRecord(record)).toBe(true);
		});

		test("returns false for invalid session record", () => {
			expect(isSessionRecord(null)).toBe(false);
			expect(isSessionRecord({})).toBe(false);
			expect(isSessionRecord({ id: "test" })).toBe(false);
			expect(isSessionRecord({ id: "test", status: "invalid" })).toBe(false);
		});
	});

	describe("isDailyUsage", () => {
		test("returns true for valid daily usage", () => {
			const usage = {
				date: "2025-01-20",
				sessionsStarted: 2,
				iterationsRun: 15,
				tasksCompleted: 5,
				totalDurationMs: 3_600_000,
			};

			expect(isDailyUsage(usage)).toBe(true);
		});

		test("returns false for invalid daily usage", () => {
			expect(isDailyUsage(null)).toBe(false);
			expect(isDailyUsage({})).toBe(false);
			expect(isDailyUsage({ date: "2025-01-20" })).toBe(false);
		});
	});

	describe("isUsageStatistics", () => {
		test("returns true for valid usage statistics", () => {
			const statistics: UsageStatistics = {
				version: 1,
				projectName: "Test Project",
				createdAt: "2025-01-20T10:00:00.000Z",
				lastUpdatedAt: "2025-01-20T10:30:00.000Z",
				lifetime: {
					totalSessions: 1,
					totalIterations: 8,
					totalTasksCompleted: 3,
					totalTasksAttempted: 4,
					totalDurationMs: 1_800_000,
					successfulIterations: 6,
					failedIterations: 2,
					averageIterationsPerSession: 8,
					averageTasksPerSession: 3,
					averageSessionDurationMs: 1_800_000,
					overallSuccessRate: 75,
				},
				recentSessions: [],
				dailyUsage: [],
			};

			expect(isUsageStatistics(statistics)).toBe(true);
		});

		test("returns false for invalid usage statistics", () => {
			expect(isUsageStatistics(null)).toBe(false);
			expect(isUsageStatistics({})).toBe(false);
			expect(isUsageStatistics({ version: 1 })).toBe(false);
		});
	});
});
