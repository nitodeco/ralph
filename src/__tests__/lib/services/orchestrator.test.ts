import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureProjectDirExists, getPrdJsonPath } from "@/lib/paths.ts";
import {
	bootstrapTestServices,
	setParallelExecutionManagerDependencies,
	teardownTestServices,
} from "@/lib/services/bootstrap.ts";
import { createBranchModeManager } from "@/lib/services/branch-mode-manager/implementation.ts";
import { createOrchestrator } from "@/lib/services/orchestrator/implementation.ts";
import type { OrchestratorCallbacks } from "@/lib/services/orchestrator/types.ts";
import { createParallelExecutionManager } from "@/lib/services/parallel-execution-manager/implementation.ts";
import { createPrdService } from "@/lib/services/prd/implementation.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { Session } from "@/lib/services/session/types.ts";
import { useAppStore } from "@/stores/appStore.ts";

const TEST_DIR = "/tmp/ralph-test-orchestrator";

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

function createMockCallbacks(): OrchestratorCallbacks {
	return {
		onPrdUpdate: () => {},
		onRestartIteration: () => {},
		onVerificationStateChange: () => {},
		onIterationComplete: () => {},
		onFatalError: () => {},
		onAppStateChange: () => {},
		setMaxRuntimeMs: () => {},
	};
}

function writePrdFile(prd: Prd): void {
	ensureProjectDirExists();
	writeFileSync(getPrdJsonPath(), JSON.stringify(prd, null, 2));
}

describe("Orchestrator Composition Root", () => {
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
			branchModeManager: createBranchModeManager(),
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
				create: (totalIterations: number, currentTaskIndex: number) =>
					createMockSession({ totalIterations, currentTaskIndex }),
				recordIterationStart: (session) => session,
				recordIterationEnd: (session) => session,
				updateIteration: (session) => session,
				updateStatus: (session, status) => ({ ...session, status }),
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
				isParallelMode: (session) => session.parallelState?.isParallelMode ?? false,
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
								executionGroups: session.parallelState.executionGroups.map((group) =>
									group.groupIndex === groupIndex
										? { ...group, isComplete: true, endTime: Date.now() }
										: group,
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
								activeExecutions: session.parallelState.activeExecutions.map((execution) =>
									execution.taskId === taskId
										? {
												...execution,
												status: wasSuccessful ? ("completed" as const) : ("failed" as const),
												endTime: Date.now(),
											}
										: execution,
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
								activeExecutions: session.parallelState.activeExecutions.map((execution) =>
									execution.taskId === taskId
										? {
												...execution,
												status: "failed" as const,
												endTime: Date.now(),
												lastError: error,
											}
										: execution,
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
								activeExecutions: session.parallelState.activeExecutions.map((execution) =>
									execution.taskId === taskId
										? {
												...execution,
												status: "running" as const,
												retryCount: execution.retryCount + 1,
											}
										: execution,
								),
							}
						: undefined,
				}),
				getActiveExecutions: (session) =>
					session.parallelState?.activeExecutions.filter(
						(execution) => execution.status === "running",
					) ?? [],
				getTaskExecution: (session, taskId) =>
					session.parallelState?.activeExecutions.find(
						(execution) => execution.taskId === taskId,
					) ?? null,
				isTaskExecuting: (session, taskId) =>
					session.parallelState?.activeExecutions.some(
						(execution) => execution.taskId === taskId && execution.status === "running",
					) ?? false,
				getActiveExecutionCount: (session) =>
					session.parallelState?.activeExecutions.filter(
						(execution) => execution.status === "running",
					).length ?? 0,
			},
			orchestrator: createOrchestrator(),
		});

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		const orchestrator = createOrchestrator();

		orchestrator.cleanup();
		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("initialize", () => {
		test("initializes with default config", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 10,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.getConfig()).toEqual({ agent: "cursor" });
		});

		test("initializes with parallel execution disabled by default", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelConfig()).toEqual({
				enabled: false,
				maxConcurrentTasks: 1,
			});
		});

		test("initializes with parallel execution enabled", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
				},
				createMockCallbacks(),
			);

			expect(orchestrator.isParallelModeEnabled()).toBe(true);
			expect(orchestrator.getParallelConfig()).toEqual({
				enabled: true,
				maxConcurrentTasks: 4,
			});
		});

		test("reinitializes when called multiple times", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			orchestrator.initialize(
				{
					config: { agent: "codex" },
					iterations: 10,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.getConfig()).toEqual({ agent: "codex" });
		});
	});

	describe("branch mode delegation", () => {
		test("isBranchModeEnabled delegates to BranchModeManager", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor", workflowMode: "branches" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.isBranchModeEnabled()).toBe(true);
		});

		test("getBranchModeConfig delegates to BranchModeManager", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: {
						agent: "cursor",
						branchMode: { enabled: true, branchPrefix: "feature" },
					},
					iterations: 5,
				},
				createMockCallbacks(),
			);

			const config = orchestrator.getBranchModeConfig();

			expect(config?.enabled).toBe(true);
			expect(config?.branchPrefix).toBe("feature");
		});

		test("getCurrentTaskBranch returns null when no branch created", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.getCurrentTaskBranch()).toBeNull();
		});

		test("getBaseBranch returns null when not initialized", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.getBaseBranch()).toBeNull();
		});
	});

	describe("parallel execution delegation", () => {
		test("initializeParallelExecution validates dependencies", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);

			const result = orchestrator.initializeParallelExecution(prd);

			expect(result.isValid).toBe(true);
		});

		test("initializeParallelExecution detects cyclic dependencies", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
				},
				createMockCallbacks(),
			);

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

		test("startNextParallelGroup returns tasks", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			const result = orchestrator.startNextParallelGroup();

			expect(result.started).toBe(true);
			expect(result.groupIndex).toBe(0);
			expect(result.tasks.length).toBeGreaterThan(0);
		});

		test("recordParallelTaskComplete tracks completion", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 3 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			const result1 = orchestrator.recordParallelTaskComplete("task-1", "Task 1", true);

			expect(result1.groupComplete).toBe(false);

			const result2 = orchestrator.recordParallelTaskComplete("task-2", "Task 2", true);

			expect(result2.groupComplete).toBe(true);
			expect(result2.allSucceeded).toBe(true);
		});

		test("getParallelExecutionSummary returns accurate data", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 2 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			const summaryBefore = orchestrator.getParallelExecutionSummary();

			expect(summaryBefore.totalGroups).toBeGreaterThan(0);
			expect(summaryBefore.completedGroups).toBe(0);
			expect(summaryBefore.isActive).toBe(false);

			orchestrator.startNextParallelGroup();

			const summaryDuring = orchestrator.getParallelExecutionSummary();

			expect(summaryDuring.isActive).toBe(true);
		});

		test("disableParallelExecution resets state", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);

			expect(orchestrator.isParallelModeEnabled()).toBe(true);

			orchestrator.disableParallelExecution();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelExecutionGroups().length).toBe(0);
		});
	});

	describe("session management delegation", () => {
		test("startSession creates a new session", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 10,
				},
				createMockCallbacks(),
			);

			const result = orchestrator.startSession(createMockPrd(), 10);

			expect(result.session).toBeDefined();
			expect(result.session.totalIterations).toBe(10);
		});

		test("resumeSession resumes an existing session", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 10,
				},
				createMockCallbacks(),
			);

			const pendingSession = createMockSession({
				currentIteration: 3,
				totalIterations: 10,
				status: "paused",
			});

			const result = orchestrator.resumeSession(pendingSession, createMockPrd());

			expect(result.session.status).toBe("running");
			expect(result.remainingIterations).toBe(7);
		});

		test("handleFatalError handles errors gracefully", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 10,
				},
				createMockCallbacks(),
			);

			const currentSession = createMockSession();
			const result = orchestrator.handleFatalError("Test error", createMockPrd(), currentSession);

			expect(result?.status).toBe("stopped");
		});
	});

	describe("verification state", () => {
		test("getIsVerifying returns false when not verifying", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(orchestrator.getIsVerifying()).toBe(false);
		});
	});

	describe("cleanup", () => {
		test("cleanup resets all state", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
					parallelExecution: { enabled: true, maxConcurrentTasks: 4 },
				},
				createMockCallbacks(),
			);

			const prd = createMockPrd();

			writePrdFile(prd);
			orchestrator.initializeParallelExecution(prd);
			orchestrator.startNextParallelGroup();

			orchestrator.cleanup();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
			expect(orchestrator.getParallelExecutionGroups().length).toBe(0);
			expect(orchestrator.getCurrentParallelGroup()).toBeNull();
		});

		test("cleanup can be called multiple times safely", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			orchestrator.cleanup();
			orchestrator.cleanup();
			orchestrator.cleanup();

			expect(orchestrator.isParallelModeEnabled()).toBe(false);
		});
	});

	describe("setupIterationCallbacks", () => {
		test("throws when not initialized", () => {
			const orchestrator = createOrchestrator();

			expect(() => {
				orchestrator.setupIterationCallbacks();
			}).toThrow("Orchestrator must be initialized");
		});

		test("sets up callbacks after initialization", () => {
			const orchestrator = createOrchestrator();

			orchestrator.initialize(
				{
					config: { agent: "cursor" },
					iterations: 5,
				},
				createMockCallbacks(),
			);

			expect(() => {
				orchestrator.setupIterationCallbacks();
			}).not.toThrow();
		});
	});
});
