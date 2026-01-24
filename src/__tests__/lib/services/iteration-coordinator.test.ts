import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createIterationCoordinator } from "@/lib/services/iteration-coordinator/implementation.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { Session } from "@/lib/services/session/types.ts";
import type { DecompositionRequest, IterationLogRetryContext } from "@/types.ts";

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

describe("IterationCoordinator", () => {
	let callbacksCalled: {
		iterationStart: number[];
		iterationComplete: number[];
		allComplete: boolean;
		maxIterations: boolean;
		maxRuntime: boolean;
	};
	let lastSpecificTask: string | null;

	beforeEach(() => {
		callbacksCalled = {
			iterationStart: [],
			iterationComplete: [],
			allComplete: false,
			maxIterations: false,
			maxRuntime: false,
		};
		lastSpecificTask = null;

		bootstrapTestServices({
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
			session: {
				load: () => null,
				save: () => {},
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
		});
	});

	afterEach(() => {
		teardownTestServices();
	});

	function createMockDependencies() {
		return {
			getAppStoreState: () => ({
				prd: createMockPrd(),
				currentSession: createMockSession(),
				elapsedTime: 0,
				manualNextTask: null,
				isVerifying: false,
				isReviewingTechnicalDebt: false,
				lastVerificationResult: null,
				lastTechnicalDebtReport: null,
				lastDecomposition: null,
				getEffectiveNextTask: () => lastSpecificTask,
				clearManualNextTask: () => {
					lastSpecificTask = null;
				},
				setPrd: () => {},
			}),
			setAppStoreState: () => {},
			getAgentStoreState: () => ({
				isComplete: false,
				error: null,
				output: "",
				exitCode: null,
				retryCount: 0,
				reset: () => {},
			}),
			getIterationStoreState: () => ({
				current: 1,
				total: 10,
				setCallbacks: (callbacks: {
					onIterationStart?: (iteration: number) => void;
					onIterationComplete?: (iteration: number) => void;
					onAllComplete?: () => void;
					onMaxIterations?: () => void;
					onMaxRuntime?: () => void;
				}) => {
					if (callbacks.onIterationStart) {
						callbacksCalled.iterationStart.push(1);
					}
				},
				restartCurrentIteration: () => {},
			}),
			startAgent: (specificTask?: string | null) => {
				lastSpecificTask = specificTask ?? null;
			},
			stopAgent: () => {},
			resetAgent: () => {},
			createTaskBranch: () => ({ success: true }),
			completeTaskBranch: async () => ({ success: true }),
		};
	}

	describe("setupIterationCallbacks", () => {
		test("sets up callbacks on iteration store", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			iterationCoordinator.setupIterationCallbacks({
				iterations: 10,
				config: { agent: "cursor" },
				skipVerification: false,
				branchModeEnabled: false,
				branchModeConfig: null,
			});

			expect(callbacksCalled.iterationStart.length).toBeGreaterThan(0);
		});

		test("caches config for later use", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			iterationCoordinator.setupIterationCallbacks({
				iterations: 10,
				config: { agent: "cursor", maxRetries: 5 },
				skipVerification: true,
				branchModeEnabled: false,
				branchModeConfig: null,
			});

			expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
		});
	});

	describe("retry context management", () => {
		test("getLastRetryContexts returns empty array initially", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
		});

		test("setLastRetryContexts stores contexts", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			const contexts: IterationLogRetryContext[] = [
				{
					attemptNumber: 1,
					failureCategory: "build_error",
					rootCause: "Missing dependency",
					contextInjected: "Error log",
				},
			];

			iterationCoordinator.setLastRetryContexts(contexts);

			expect(iterationCoordinator.getLastRetryContexts()).toEqual(contexts);
		});

		test("setLastRetryContexts overwrites previous contexts", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			const contexts1: IterationLogRetryContext[] = [
				{
					attemptNumber: 1,
					failureCategory: "build_error",
					rootCause: "Error 1",
					contextInjected: "Context 1",
				},
			];

			const contexts2: IterationLogRetryContext[] = [
				{
					attemptNumber: 2,
					failureCategory: "test_failure",
					rootCause: "Error 2",
					contextInjected: "Context 2",
				},
			];

			iterationCoordinator.setLastRetryContexts(contexts1);
			iterationCoordinator.setLastRetryContexts(contexts2);

			expect(iterationCoordinator.getLastRetryContexts()).toEqual(contexts2);
		});
	});

	describe("decomposition management", () => {
		test("getLastDecomposition returns null initially", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			expect(iterationCoordinator.getLastDecomposition()).toBeNull();
		});

		test("setLastDecomposition stores decomposition", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			const decomposition: DecompositionRequest = {
				originalTaskTitle: "Complex task",
				reason: "Too complex",
				suggestedSubtasks: [
					{ title: "Subtask 1", description: "First part", steps: ["Step 1"] },
					{ title: "Subtask 2", description: "Second part", steps: ["Step 2"] },
				],
			};

			iterationCoordinator.setLastDecomposition(decomposition);

			expect(iterationCoordinator.getLastDecomposition()).toEqual(decomposition);
		});

		test("setLastDecomposition with null clears decomposition", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			const decomposition: DecompositionRequest = {
				originalTaskTitle: "Complex task",
				reason: "Too complex",
				suggestedSubtasks: [],
			};

			iterationCoordinator.setLastDecomposition(decomposition);
			iterationCoordinator.setLastDecomposition(null);

			expect(iterationCoordinator.getLastDecomposition()).toBeNull();
		});
	});

	describe("clearState", () => {
		test("clears all state", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			const contexts: IterationLogRetryContext[] = [
				{
					attemptNumber: 1,
					failureCategory: "build_error",
					rootCause: "Error",
					contextInjected: "Context",
				},
			];

			const decomposition: DecompositionRequest = {
				originalTaskTitle: "Task",
				reason: "Reason",
				suggestedSubtasks: [],
			};

			iterationCoordinator.setLastRetryContexts(contexts);
			iterationCoordinator.setLastDecomposition(decomposition);

			iterationCoordinator.clearState();

			expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
			expect(iterationCoordinator.getLastDecomposition()).toBeNull();
		});

		test("can be called multiple times safely", () => {
			const iterationCoordinator = createIterationCoordinator(createMockDependencies());

			iterationCoordinator.clearState();
			iterationCoordinator.clearState();
			iterationCoordinator.clearState();

			expect(iterationCoordinator.getLastRetryContexts()).toEqual([]);
			expect(iterationCoordinator.getLastDecomposition()).toBeNull();
		});
	});

	describe("state isolation", () => {
		test("multiple coordinators have independent state", () => {
			const coordinator1 = createIterationCoordinator(createMockDependencies());
			const coordinator2 = createIterationCoordinator(createMockDependencies());

			const contexts1: IterationLogRetryContext[] = [
				{
					attemptNumber: 1,
					failureCategory: "build_error",
					rootCause: "Error 1",
					contextInjected: "Context 1",
				},
			];

			const contexts2: IterationLogRetryContext[] = [
				{
					attemptNumber: 2,
					failureCategory: "test_failure",
					rootCause: "Error 2",
					contextInjected: "Context 2",
				},
			];

			coordinator1.setLastRetryContexts(contexts1);
			coordinator2.setLastRetryContexts(contexts2);

			expect(coordinator1.getLastRetryContexts()).toEqual(contexts1);
			expect(coordinator2.getLastRetryContexts()).toEqual(contexts2);
		});
	});
});
