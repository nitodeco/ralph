import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureProjectDirExists, getPrdJsonPath } from "@/lib/paths.ts";
import {
	bootstrapTestServices,
	createParallelExecutionManager,
	createPrdService,
	setParallelExecutionManagerDependencies,
	teardownTestServices,
} from "@/lib/services/index.ts";
import { useAppStore } from "@/stores/appStore.ts";
import { orchestrator } from "@/stores/orchestrator.ts";
import type { Prd, RalphConfig } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-orchestrator-parallel";

function writePrdFile(prd: Prd): void {
	ensureProjectDirExists();
	writeFileSync(getPrdJsonPath(), JSON.stringify(prd, null, 2));
}

function createMockSession() {
	return {
		startTime: Date.now(),
		lastUpdateTime: Date.now(),
		currentIteration: 0,
		totalIterations: 10,
		currentTaskIndex: 0,
		status: "running" as const,
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
	};
}

describe("orchestrator parallel execution", () => {
	beforeEach(() => {
		setParallelExecutionManagerDependencies({
			getAppStoreState: () => {
				const state = useAppStore.getState();

				return {
					prd: state.prd,
					currentSession: state.currentSession,
				};
			},
			setAppStoreState: (newState) => {
				useAppStore.setState(newState);
			},
		});

		bootstrapTestServices({
			prd: createPrdService(),
			parallelExecutionManager: createParallelExecutionManager({
				getAppStoreState: () => {
					const state = useAppStore.getState();

					return {
						prd: state.prd,
						currentSession: state.currentSession,
					};
				},
				setAppStoreState: (newState) => {
					useAppStore.setState(newState);
				},
			}),
			session: {
				load: () => null,
				save: () => {},
				delete: () => {},
				exists: () => false,
				create: (totalIterations: number, currentTaskIndex: number) => ({
					...createMockSession(),
					totalIterations,
					currentTaskIndex,
				}),
				recordIterationStart: (s) => s,
				recordIterationEnd: (s) => s,
				updateIteration: (s) => s,
				updateStatus: (s) => s,
				isResumable: () => false,
				enableParallelMode: (session, maxConcurrentTasks) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: {
						isParallelMode: true,
						currentGroupIndex: -1,
						executionGroups: [],
						activeExecutions: [],
						maxConcurrentTasks,
					},
				}),
				disableParallelMode: (session) => {
					const { parallelState: _, ...rest } = session;

					return { ...rest, lastUpdateTime: Date.now() };
				},
				isParallelMode: (s) => s.parallelState?.isParallelMode ?? false,
				startParallelGroup: (session, groupIndex) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								currentGroupIndex: groupIndex,
								executionGroups: [
									...session.parallelState.executionGroups,
									{
										groupIndex,
										startTime: Date.now(),
										endTime: null,
										taskExecutions: [],
										isComplete: false,
									},
								],
							}
						: undefined,
				}),
				completeParallelGroup: (session, groupIndex) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								executionGroups: session.parallelState.executionGroups.map((g) =>
									g.groupIndex === groupIndex ? { ...g, isComplete: true, endTime: Date.now() } : g,
								),
							}
						: undefined,
				}),
				getCurrentParallelGroup: (session) => {
					if (!session.parallelState) {
						return null;
					}

					const idx = session.parallelState.currentGroupIndex;

					return session.parallelState.executionGroups.find((g) => g.groupIndex === idx) ?? null;
				},
				startTaskExecution: (session, taskInfo) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								activeExecutions: [
									...session.parallelState.activeExecutions,
									{
										taskId: taskInfo.taskId,
										taskTitle: taskInfo.taskTitle,
										taskIndex: taskInfo.taskIndex,
										status: "running" as const,
										startTime: Date.now(),
										endTime: null,
										processId: taskInfo.processId,
										retryCount: 0,
										lastError: null,
									},
								],
							}
						: undefined,
				}),
				completeTaskExecution: (session, taskId, wasSuccessful) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								activeExecutions: session.parallelState.activeExecutions.map((e) =>
									e.taskId === taskId
										? {
												...e,
												status: wasSuccessful ? ("completed" as const) : ("failed" as const),
												endTime: Date.now(),
											}
										: e,
								),
							}
						: undefined,
				}),
				failTaskExecution: (session, taskId, error) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								activeExecutions: session.parallelState.activeExecutions.map((e) =>
									e.taskId === taskId
										? { ...e, status: "failed" as const, endTime: Date.now(), lastError: error }
										: e,
								),
							}
						: undefined,
				}),
				retryTaskExecution: (session, taskId) => ({
					...session,
					lastUpdateTime: Date.now(),
					parallelState: session.parallelState
						? {
								...session.parallelState,
								activeExecutions: session.parallelState.activeExecutions.map((e) =>
									e.taskId === taskId
										? { ...e, status: "running" as const, retryCount: e.retryCount + 1 }
										: e,
								),
							}
						: undefined,
				}),
				getActiveExecutions: (session) =>
					session.parallelState?.activeExecutions.filter((e) => e.status === "running") ?? [],
				getTaskExecution: (session, taskId) =>
					session.parallelState?.activeExecutions.find((e) => e.taskId === taskId) ?? null,
				isTaskExecuting: (session, taskId) =>
					session.parallelState?.activeExecutions.some(
						(e) => e.taskId === taskId && e.status === "running",
					) ?? false,
				getActiveExecutionCount: (session) =>
					session.parallelState?.activeExecutions.filter((e) => e.status === "running").length ?? 0,
			},
		});

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		orchestrator.cleanup();
		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("initialization", () => {
		test("initializes with parallel execution disabled by default", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
			});

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelConfig()).toEqual({ enabled: false, maxConcurrentTasks: 1 });
		});

		test("initializes with parallel execution enabled", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
			});

			expect(orchestrator.isParallelModeEnabled()).toBe(true);
			expect(orchestrator.getParallelConfig()).toEqual({ enabled: true, maxConcurrentTasks: 4 });
		});
	});

	describe("parallel execution initialization", () => {
		test("validates dependencies and computes parallel groups", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
					{
						id: "task-3",
						title: "Task 3",
						description: "",
						steps: [],
						done: false,
						dependsOn: ["task-1"],
					},
				],
			};

			writePrdFile(prd);

			const result = orchestrator.initializeParallelExecution(prd);

			expect(result.isValid).toBe(true);
			expect(orchestrator.getParallelExecutionGroups().length).toBeGreaterThan(0);
		});

		test("fails validation for cyclic dependencies", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{
						id: "task-1",
						title: "Task 1",
						description: "",
						steps: [],
						done: false,
						dependsOn: ["task-2"],
					},
					{
						id: "task-2",
						title: "Task 2",
						description: "",
						steps: [],
						done: false,
						dependsOn: ["task-1"],
					},
				],
			};

			writePrdFile(prd);

			const result = orchestrator.initializeParallelExecution(prd);

			expect(result.isValid).toBe(false);
			expect(result.error).toContain("Invalid task dependencies");
		});

		test("skips initialization when parallel mode is disabled", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
			});

			const prd: Prd = {
				project: "Test",
				tasks: [{ id: "task-1", title: "Task 1", description: "", steps: [], done: false }],
			};

			writePrdFile(prd);

			const result = orchestrator.initializeParallelExecution(prd);

			expect(result.isValid).toBe(true);
			expect(orchestrator.getParallelExecutionGroups().length).toBe(0);
		});
	});

	describe("parallel group management", () => {
		test("starts next parallel group and returns tasks", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
					{ id: "task-3", title: "Task 3", description: "", steps: [], done: false },
				],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			const result = orchestrator.startNextParallelGroup();

			expect(result.started).toBe(true);
			expect(result.groupIndex).toBe(0);
			expect(result.tasks.length).toBeGreaterThan(0);
			expect(result.tasks.length).toBeLessThanOrEqual(2);
		});

		test("returns false when no more groups available", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 10 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [{ id: "task-1", title: "Task 1", description: "", steps: [], done: false }],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			orchestrator.recordParallelTaskComplete("task-1", "Task 1", true);

			const result = orchestrator.startNextParallelGroup();

			expect(result.started).toBe(false);
			expect(result.groupIndex).toBe(-1);
		});
	});

	describe("task completion tracking", () => {
		test("tracks task completion within a group", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 3 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
				],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			const result1 = orchestrator.recordParallelTaskComplete("task-1", "Task 1", true);

			expect(result1.groupComplete).toBe(false);

			const result2 = orchestrator.recordParallelTaskComplete("task-2", "Task 2", true);

			expect(result2.groupComplete).toBe(true);
			expect(result2.allSucceeded).toBe(true);
		});

		test("tracks failed tasks separately", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 3 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
				],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			orchestrator.recordParallelTaskComplete("task-1", "Task 1", true);
			const result = orchestrator.recordParallelTaskComplete(
				"task-2",
				"Task 2",
				false,
				"Test error",
			);

			expect(result.groupComplete).toBe(true);
			expect(result.allSucceeded).toBe(false);
		});
	});

	describe("parallel execution summary", () => {
		test("returns accurate summary", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
					{
						id: "task-3",
						title: "Task 3",
						description: "",
						steps: [],
						done: false,
						dependsOn: ["task-1"],
					},
				],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			const summaryBefore = orchestrator.getParallelExecutionSummary();

			expect(summaryBefore.totalGroups).toBeGreaterThan(0);
			expect(summaryBefore.completedGroups).toBe(0);
			expect(summaryBefore.isActive).toBe(false);

			orchestrator.startNextParallelGroup();

			const summaryDuring = orchestrator.getParallelExecutionSummary();

			expect(summaryDuring.isActive).toBe(true);
			expect(summaryDuring.currentGroupIndex).toBe(0);
		});

		test("hasMoreParallelGroups returns correct value", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 10 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [{ id: "task-1", title: "Task 1", description: "", steps: [], done: false }],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			expect(orchestrator.hasMoreParallelGroups()).toBe(true);

			orchestrator.startNextParallelGroup();
			orchestrator.recordParallelTaskComplete("task-1", "Task 1", true);

			expect(orchestrator.hasMoreParallelGroups()).toBe(false);
		});
	});

	describe("disable parallel execution", () => {
		test("disables parallel mode and resets state", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [
					{ id: "task-1", title: "Task 1", description: "", steps: [], done: false },
					{ id: "task-2", title: "Task 2", description: "", steps: [], done: false },
				],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			expect(orchestrator.isParallelModeEnabled()).toBe(true);

			orchestrator.disableParallelExecution();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelExecutionGroups().length).toBe(0);
			expect(orchestrator.getCurrentParallelGroup()).toBeNull();
		});

		test("is idempotent when already disabled", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
			});

			expect(orchestrator.isParallelModeEnabled()).toBe(false);

			orchestrator.disableParallelExecution();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
		});
	});

	describe("cleanup", () => {
		test("resets all parallel execution state on cleanup", () => {
			const config: RalphConfig = { agent: "cursor" };

			orchestrator.initialize({
				config,
				iterations: 5,
				parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
			});

			const prd: Prd = {
				project: "Test",
				tasks: [{ id: "task-1", title: "Task 1", description: "", steps: [], done: false }],
			};

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			orchestrator.cleanup();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelExecutionGroups().length).toBe(0);
			expect(orchestrator.getCurrentParallelGroup()).toBeNull();
		});
	});
});
