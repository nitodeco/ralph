import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { Session } from "@/lib/services/session/types.ts";
import { createSessionManager } from "@/lib/services/session-manager/implementation.ts";

function createMockSession(overrides: Partial<Session> = {}): Session {
	return {
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
		...overrides,
	};
}

function createMockPrd(overrides: Partial<Prd> = {}): Prd {
	return {
		project: "Test Project",
		tasks: [
			{ id: "task-1", title: "Task 1", description: "First task", steps: [], done: false },
			{ id: "task-2", title: "Task 2", description: "Second task", steps: [], done: false },
		],
		...overrides,
	};
}

describe("SessionManager", () => {
	let savedSession: Session | null = null;

	beforeEach(() => {
		savedSession = null;

		bootstrapTestServices({
			session: {
				load: () => null,
				save: (session) => {
					savedSession = session;
				},
				delete: () => {},
				exists: () => false,
				create: (totalIterations: number, currentTaskIndex: number) =>
					createMockSession({ totalIterations, currentTaskIndex }),
				recordIterationStart: (session) => ({ ...session, lastUpdateTime: Date.now() }),
				recordIterationEnd: (session) => ({ ...session, lastUpdateTime: Date.now() }),
				updateIteration: (session, currentIteration, currentTaskIndex, elapsedTimeSeconds) => ({
					...session,
					currentIteration,
					currentTaskIndex,
					elapsedTimeSeconds,
					lastUpdateTime: Date.now(),
				}),
				updateStatus: (session, status) => ({ ...session, status, lastUpdateTime: Date.now() }),
				isResumable: () => false,
				enableParallelMode: (session) => session,
				disableParallelMode: (session) => session,
				isParallelMode: () => false,
				startParallelGroup: (session) => session,
				completeParallelGroup: (session) => session,
				getCurrentParallelGroup: () => null,
				startTaskExecution: (session) => session,
				completeTaskExecution: (session) => session,
				failTaskExecution: (session) => session,
				retryTaskExecution: (session) => session,
				getActiveExecutions: () => [],
				getTaskExecution: () => null,
				isTaskExecuting: () => false,
				getActiveExecutionCount: () => 0,
			},
			prd: {
				get: () => createMockPrd(),
				load: () => createMockPrd(),
				loadWithValidation: () => ({ prd: createMockPrd() }),
				reload: () => createMockPrd(),
				reloadWithValidation: () => ({ prd: createMockPrd() }),
				save: () => {},
				invalidate: () => {},
				findFile: () => null,
				isComplete: () => false,
				getNextTask: () => createMockPrd().tasks[0]?.title ?? null,
				getNextTaskWithIndex: () => {
					const task = createMockPrd().tasks[0];

					return task ? { ...task, title: task.title ?? "Task", index: 0 } : null;
				},
				getTaskByTitle: () => null,
				getTaskByIndex: () => null,
				getCurrentTaskIndex: () => 0,
				canWorkOnTask: () => ({ canWork: true }),
				createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
				loadInstructions: () => null,
				toggleTaskDone: (prd) => prd,
				deleteTask: (prd) => prd,
				reorderTask: (prd) => prd,
				updateTask: (prd) => prd,
			},
			usageStatistics: {
				get: () => ({
					version: 1,
					projectName: "Test Project",
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
					projectName: "Test Project",
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
					projectName: "Test Project",
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
			sessionMemory: {
				get: () => ({
					projectName: "Test Project",
					lessonsLearned: [],
					successfulPatterns: [],
					failedApproaches: [],
					taskNotes: {},
					lastUpdated: new Date().toISOString(),
				}),
				load: () => ({
					projectName: "Test Project",
					lessonsLearned: [],
					successfulPatterns: [],
					failedApproaches: [],
					taskNotes: {},
					lastUpdated: new Date().toISOString(),
				}),
				save: () => {},
				exists: () => false,
				initialize: () => ({
					projectName: "Test Project",
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
		});
	});

	afterEach(() => {
		teardownTestServices();
	});

	describe("startSession", () => {
		test("creates a new session with correct parameters", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const prd = createMockPrd();
			const result = sessionManager.startSession(prd, 10);

			expect(result.session).toBeDefined();
			expect(result.session.totalIterations).toBe(10);
			expect(result.taskIndex).toBe(0);
		});

		test("saves the session after creation", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const prd = createMockPrd();

			sessionManager.startSession(prd, 5);

			expect(savedSession).not.toBeNull();
			expect(savedSession?.totalIterations).toBe(5);
		});

		test("handles null PRD gracefully", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const result = sessionManager.startSession(null, 10);

			expect(result.session).toBeDefined();
			expect(result.taskIndex).toBe(0);
		});
	});

	describe("resumeSession", () => {
		test("resumes an existing session", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const pendingSession = createMockSession({
				currentIteration: 3,
				totalIterations: 10,
				status: "paused",
			});

			const result = sessionManager.resumeSession(pendingSession, createMockPrd());

			expect(result.session.status).toBe("running");
			expect(result.remainingIterations).toBe(7);
		});

		test("returns at least 1 remaining iteration", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const pendingSession = createMockSession({
				currentIteration: 10,
				totalIterations: 10,
				status: "paused",
			});

			const result = sessionManager.resumeSession(pendingSession, createMockPrd());

			expect(result.remainingIterations).toBe(1);
		});

		test("saves the resumed session", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const pendingSession = createMockSession({ status: "paused" });

			sessionManager.resumeSession(pendingSession, createMockPrd());

			expect(savedSession).not.toBeNull();
			expect(savedSession?.status).toBe("running");
		});
	});

	describe("handleFatalError", () => {
		test("handles fatal error with active session", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: 1, retryCount: 2, output: "error output" }),
				getIterationStoreState: () => ({ current: 5 }),
			});

			const currentSession = createMockSession();
			const result = sessionManager.handleFatalError("Test error", createMockPrd(), currentSession);

			expect(result.session?.status).toBe("stopped");
			expect(result.wasHandled).toBe(true);
		});

		test("handles fatal error without active session", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: 1, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const result = sessionManager.handleFatalError("Test error", createMockPrd(), null);

			expect(result.session).toBeNull();
			expect(result.wasHandled).toBe(true);
		});

		test("saves the stopped session", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: 1, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const currentSession = createMockSession();

			sessionManager.handleFatalError("Test error", createMockPrd(), currentSession);

			expect(savedSession).not.toBeNull();
			expect(savedSession?.status).toBe("stopped");
		});
	});

	describe("setConfig", () => {
		test("caches config for later use", () => {
			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			sessionManager.setConfig({ agent: "cursor" });

			const result = sessionManager.startSession(createMockPrd(), 5);

			expect(result.session).toBeDefined();
		});
	});

	describe("recordUsageStatistics", () => {
		test("records statistics for completed session", () => {
			let recordedSessionData: unknown = null;

			teardownTestServices();

			const mockUsageStats = {
				version: 1,
				projectName: "Test Project",
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
			};

			bootstrapTestServices({
				usageStatistics: {
					get: () => mockUsageStats,
					load: () => mockUsageStats,
					save: () => {},
					exists: () => false,
					initialize: () => mockUsageStats,
					invalidate: () => {},
					recordSession: (data) => {
						recordedSessionData = data;
					},
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
			});

			const sessionManager = createSessionManager({
				getAgentStoreState: () => ({ exitCode: null, retryCount: 0, output: "" }),
				getIterationStoreState: () => ({ current: 0 }),
			});

			const session = createMockSession({
				statistics: {
					totalIterations: 10,
					completedIterations: 8,
					failedIterations: 2,
					successfulIterations: 6,
					totalDurationMs: 60000,
					averageDurationMs: 6000,
					successRate: 0.75,
					iterationTimings: [],
				},
			});

			const prd = createMockPrd({
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: true },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
				],
			});

			sessionManager.recordUsageStatistics(session, prd, "completed");

			expect(recordedSessionData).not.toBeNull();
			expect((recordedSessionData as { status: string }).status).toBe("completed");
			expect((recordedSessionData as { tasksCompleted: number }).tasksCompleted).toBe(1);
		});
	});
});
