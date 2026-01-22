import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	initializeServices,
	resetServices,
	type ServiceContainer,
} from "@/lib/services/container.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";
import { createSessionService } from "@/lib/services/session/implementation.ts";
import type { Session, SessionStatus } from "@/types.ts";

const TEST_DIR = join(tmpdir(), `ralph-test-session-${Date.now()}`);
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

function createMockServices(
	projectRegistryService: ReturnType<typeof createProjectRegistryService>,
): ServiceContainer {
	const defaultConfig = {
		agent: "cursor" as const,
		maxRetries: 3,
		retryDelayMs: 1000,
		agentTimeoutMs: 300000,
		stuckThresholdMs: 60000,
		maxOutputHistoryBytes: 1048576,
		retryWithContext: true,
		maxDecompositionsPerTask: 3,
		learningEnabled: true,
		verification: { enabled: false, failOnWarning: false },
	};

	return {
		projectRegistry: projectRegistryService,
		config: {
			get: () => defaultConfig,
			load: () => defaultConfig,
			loadGlobal: () => defaultConfig,
			loadGlobalRaw: () => null,
			loadProjectRaw: () => null,
			getWithValidation: (validateFn) => ({
				config: defaultConfig,
				validation: validateFn(defaultConfig),
			}),
			saveGlobal: () => {},
			saveProject: () => {},
			invalidate: () => {},
			invalidateGlobal: () => {},
			invalidateAll: () => {},
			globalConfigExists: () => true,
			getEffective: () => ({ global: null, project: null, effective: defaultConfig }),
		},
		guardrails: {
			get: () => [],
			load: () => [],
			save: () => {},
			exists: () => false,
			initialize: () => {},
			invalidate: () => {},
			add: () => ({
				id: "test",
				instruction: "test",
				trigger: "always" as const,
				category: "quality" as const,
				enabled: true,
				addedAt: new Date().toISOString(),
			}),
			remove: () => true,
			toggle: () => null,
			getById: () => null,
			getActive: () => [],
			formatForPrompt: () => "",
		},
		rules: {
			get: () => [],
			load: () => [],
			save: () => {},
			exists: () => false,
			initialize: () => {},
			invalidate: () => {},
			add: () => ({
				id: "test",
				instruction: "test",
				addedAt: new Date().toISOString(),
			}),
			remove: () => true,
			getById: () => null,
			formatForPrompt: () => "",
		},
		prd: {
			get: () => null,
			load: () => null,
			loadWithValidation: () => ({ prd: null }),
			reload: () => null,
			reloadWithValidation: () => ({ prd: null }),
			save: () => {},
			invalidate: () => {},
			findFile: () => null,
			isComplete: () => false,
			getNextTask: () => null,
			getNextTaskWithIndex: () => null,
			getTaskByTitle: () => null,
			getTaskByIndex: () => null,
			getCurrentTaskIndex: () => -1,
			canWorkOnTask: () => ({ canWork: true }),
			createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
			loadInstructions: () => null,
		},
		sessionMemory: {
			get: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			load: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			save: () => {},
			exists: () => false,
			initialize: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			invalidate: () => {},
			addLesson: () => {},
			addSuccessPattern: () => {},
			addFailedApproach: () => {},
			addTaskNote: () => {},
			getTaskNote: () => null,
			clear: () => {},
			getStats: () => ({
				lessonsCount: 0,
				patternsCount: 0,
				failedApproachesCount: 0,
				taskNotesCount: 0,
				lastUpdated: null,
			}),
			formatForPrompt: () => "",
			formatForTask: () => "",
			exportAsMarkdown: () => "",
		},
		session: {
			load: () => null,
			save: () => {},
			delete: () => {},
			exists: () => false,
			create: (total, task) => ({
				startTime: Date.now(),
				lastUpdateTime: Date.now(),
				currentIteration: 0,
				totalIterations: total,
				currentTaskIndex: task,
				status: "running" as const,
				elapsedTimeSeconds: 0,
				statistics: {
					totalIterations: total,
					completedIterations: 0,
					failedIterations: 0,
					successfulIterations: 0,
					totalDurationMs: 0,
					averageDurationMs: 0,
					successRate: 0,
					iterationTimings: [],
				},
			}),
			recordIterationStart: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			recordIterationEnd: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			updateIteration: (s, i, t, e) => ({
				...s,
				currentIteration: i,
				currentTaskIndex: t,
				elapsedTimeSeconds: e,
				lastUpdateTime: Date.now(),
			}),
			updateStatus: (s, status) => ({ ...s, status, lastUpdateTime: Date.now() }),
			isResumable: () => false,
			enableParallelMode: (s, max) => ({
				...s,
				parallelState: {
					isParallelMode: true,
					currentGroupIndex: -1,
					executionGroups: [],
					activeExecutions: [],
					maxConcurrentTasks: max,
				},
			}),
			disableParallelMode: (s) => {
				const { parallelState: _, ...rest } = s;

				return rest;
			},
			isParallelMode: (s) => s.parallelState?.isParallelMode ?? false,
			startParallelGroup: (s) => s,
			completeParallelGroup: (s) => s,
			getCurrentParallelGroup: () => null,
			startTaskExecution: (s) => s,
			completeTaskExecution: (s) => s,
			failTaskExecution: (s) => s,
			retryTaskExecution: (s) => s,
			getActiveExecutions: () => [],
			getTaskExecution: () => null,
			isTaskExecuting: () => false,
			getActiveExecutionCount: () => 0,
		},
		sleepPrevention: {
			start: () => {},
			stop: () => {},
			isActive: () => false,
		},
		usageStatistics: {
			get: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			load: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			save: () => {},
			exists: () => false,
			initialize: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			invalidate: () => {},
			recordSession: () => {},
			getSummary: () => ({
				totalSessions: 0,
				totalIterations: 0,
				totalTasksCompleted: 0,
				totalDurationMs: 0,
				overallSuccessRate: 0,
				averageSessionDurationMs: 0,
				averageIterationsPerSession: 0,
				lastSessionAt: null,
				streakDays: 0,
			}),
			getRecentSessions: () => [],
			getDailyUsage: () => [],
			formatForDisplay: () => "",
		},
	};
}

const ORIGINAL_CWD = process.cwd();

describe("session functions", () => {
	let sessionService: ReturnType<typeof createSessionService>;

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
		const services = createMockServices(projectRegistryService);

		initializeServices(services);

		process.chdir(TEST_DIR);
		sessionService = createSessionService();
	});

	afterEach(() => {
		try {
			process.chdir(ORIGINAL_CWD);
		} catch {
			// Ignore if directory doesn't exist
		}

		resetServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("create", () => {
		test("creates session with correct initial state", () => {
			const session = sessionService.create(10, 0);

			expect(session.totalIterations).toBe(10);
			expect(session.currentIteration).toBe(0);
			expect(session.currentTaskIndex).toBe(0);
			expect(session.status).toBe("running");
			expect(session.elapsedTimeSeconds).toBe(0);
			expect(session.startTime).toBeGreaterThan(0);
			expect(session.lastUpdateTime).toBeGreaterThanOrEqual(session.startTime);
			expect(session.statistics).toBeDefined();
			expect(session.statistics.totalIterations).toBe(10);
			expect(session.statistics.completedIterations).toBe(0);
		});

		test("initializes statistics correctly", () => {
			const session = sessionService.create(5, 2);

			expect(session.statistics.totalIterations).toBe(5);
			expect(session.statistics.completedIterations).toBe(0);
			expect(session.statistics.successfulIterations).toBe(0);
			expect(session.statistics.failedIterations).toBe(0);
			expect(session.statistics.totalDurationMs).toBe(0);
			expect(session.statistics.averageDurationMs).toBe(0);
			expect(session.statistics.successRate).toBe(0);
			expect(session.statistics.iterationTimings).toEqual([]);
		});
	});

	describe("save and load", () => {
		test("saves and loads session correctly", () => {
			const originalSession = sessionService.create(10, 0);

			sessionService.save(originalSession);
			expect(sessionService.exists()).toBe(true);

			const loadedSession = sessionService.load();

			expect(loadedSession).not.toBeNull();
			expect(loadedSession?.totalIterations).toBe(10);
			expect(loadedSession?.currentIteration).toBe(0);
			expect(loadedSession?.status).toBe("running");
		});

		test("load returns null when file does not exist", () => {
			expect(sessionService.exists()).toBe(false);
			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});

		test("load returns null for session without statistics", () => {
			const session = sessionService.create(5, 0);

			delete (session as Partial<Session>).statistics;
			sessionService.save(session);

			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});

		test("load handles corrupted JSON gracefully", () => {
			const sessionPath = join(TEST_PROJECT_DIR, "session.json");

			writeFileSync(sessionPath, "{ invalid json }");

			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});
	});

	describe("delete", () => {
		test("deletes session file when it exists", () => {
			const session = sessionService.create(10, 0);

			sessionService.save(session);
			expect(sessionService.exists()).toBe(true);

			sessionService.delete();
			expect(sessionService.exists()).toBe(false);
		});

		test("does not throw when session file does not exist", () => {
			expect(() => sessionService.delete()).not.toThrow();
		});
	});

	describe("exists", () => {
		test("returns false when session file does not exist", () => {
			expect(sessionService.exists()).toBe(false);
		});

		test("returns true when session file exists", () => {
			const session = sessionService.create(10, 0);

			sessionService.save(session);
			expect(sessionService.exists()).toBe(true);
		});
	});

	describe("recordIterationStart", () => {
		test("creates new timing entry for iteration", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.recordIterationStart(session, 1);

			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.iteration).toBe(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThan(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeNull();
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeNull();
		});

		test("updates existing timing entry if iteration already exists", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const updated = sessionService.recordIterationStart(withStart, 1);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThanOrEqual(
				withStart.statistics.iterationTimings[0]?.startTime ?? 0,
			);
		});

		test("adds multiple iteration timings", () => {
			const session = sessionService.create(10, 0);
			const iter1 = sessionService.recordIterationStart(session, 1);
			const iter2 = sessionService.recordIterationStart(iter1, 2);

			expect(iter2.statistics.iterationTimings).toHaveLength(2);
		});
	});

	describe("recordIterationEnd", () => {
		test("completes iteration timing and updates statistics", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const startTime = withStart.statistics.iterationTimings[0]?.startTime ?? 0;

			const updated = sessionService.recordIterationEnd(withStart, 1, true);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(1);
			expect(updated.statistics.failedIterations).toBe(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeGreaterThanOrEqual(startTime);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeGreaterThanOrEqual(0);
			expect(updated.statistics.successRate).toBe(100);
		});

		test("records failed iteration correctly", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);

			const updated = sessionService.recordIterationEnd(withStart, 1, false);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(0);
			expect(updated.statistics.failedIterations).toBe(1);
			expect(updated.statistics.successRate).toBe(0);
		});

		test("calculates average duration correctly", () => {
			const session = sessionService.create(10, 0);
			const iter1 = sessionService.recordIterationStart(session, 1);
			const iter1End = sessionService.recordIterationEnd(iter1, 1, true);
			const iter2 = sessionService.recordIterationStart(iter1End, 2);
			const iter2End = sessionService.recordIterationEnd(iter2, 2, true);

			expect(iter2End.statistics.completedIterations).toBe(2);
			expect(iter2End.statistics.averageDurationMs).toBeGreaterThanOrEqual(0);
			expect(iter2End.statistics.totalDurationMs).toBeGreaterThanOrEqual(0);
		});

		test("creates timing entry if iteration start was not recorded", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.recordIterationEnd(session, 1, true);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBe(0);
		});

		test("updates existing timing entry", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const firstEnd = sessionService.recordIterationEnd(withStart, 1, true);
			const secondEnd = sessionService.recordIterationEnd(firstEnd, 1, false);

			expect(secondEnd.statistics.iterationTimings).toHaveLength(1);
			expect(secondEnd.statistics.failedIterations).toBe(1);
		});
	});

	describe("updateIteration", () => {
		test("updates iteration and task index", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateIteration(session, 5, 3, 120);

			expect(updated.currentIteration).toBe(5);
			expect(updated.currentTaskIndex).toBe(3);
			expect(updated.elapsedTimeSeconds).toBe(120);
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateIteration(session, 2, 1, 60);

			expect(updated.totalIterations).toBe(10);
			expect(updated.status).toBe("running");
			expect(updated.startTime).toBe(session.startTime);
		});
	});

	describe("updateStatus", () => {
		test("updates status correctly", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateStatus(session, "paused");

			expect(updated.status).toBe("paused");
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateStatus(session, "stopped");

			expect(updated.totalIterations).toBe(10);
			expect(updated.currentIteration).toBe(0);
			expect(updated.startTime).toBe(session.startTime);
		});

		test("handles all status types", () => {
			const session = sessionService.create(10, 0);
			const statuses: SessionStatus[] = ["running", "paused", "stopped", "completed"];

			for (const status of statuses) {
				const updated = sessionService.updateStatus(session, status);

				expect(updated.status).toBe(status);
			}
		});
	});

	describe("isResumable", () => {
		test("returns false for null session", () => {
			expect(sessionService.isResumable(null)).toBe(false);
		});

		test("returns true for running status", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns true for paused status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "paused");

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns true for stopped status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "stopped");

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns false for completed status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "completed");

			expect(sessionService.isResumable(session)).toBe(false);
		});
	});
});
