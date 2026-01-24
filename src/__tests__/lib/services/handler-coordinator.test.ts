import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eventBus } from "@/lib/events.ts";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createHandlerCoordinator } from "@/lib/services/handler-coordinator/implementation.ts";
import type { Prd } from "@/lib/services/prd/types.ts";
import type { VerificationResult } from "@/types.ts";

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

describe("HandlerCoordinator", () => {
	let verificationStateChanges: Array<{
		isVerifying: boolean;
		result: VerificationResult | null;
	}>;
	let iterationCompleteCalls: Array<{ allTasksDone: boolean; hasPendingTasks: boolean }>;
	let fatalErrorCalls: Array<{ error: string }>;
	let appStateChanges: Array<"error">;

	beforeEach(() => {
		verificationStateChanges = [];
		iterationCompleteCalls = [];
		fatalErrorCalls = [];
		appStateChanges = [];

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
			iterationCoordinator: {
				setupIterationCallbacks: () => {},
				getLastRetryContexts: () => [],
				getLastDecomposition: () => null,
				setLastRetryContexts: () => {},
				setLastDecomposition: () => {},
				clearState: () => {},
			},
		});
	});

	afterEach(() => {
		eventBus.removeAllListeners();
		teardownTestServices();
	});

	function createMockCallbacks() {
		return {
			onPrdUpdate: () => {},
			onRestartIteration: () => {},
			onVerificationStateChange: (isVerifying: boolean, result: VerificationResult | null) => {
				verificationStateChanges.push({ isVerifying, result });
			},
			onIterationComplete: (allTasksDone: boolean, hasPendingTasks: boolean) => {
				iterationCompleteCalls.push({ allTasksDone, hasPendingTasks });
			},
			onFatalError: (error: string) => {
				fatalErrorCalls.push({ error });
			},
			onAppStateChange: (state: "error") => {
				appStateChanges.push(state);
			},
		};
	}

	describe("initialize", () => {
		test("initializes without errors", () => {
			const handlerCoordinator = createHandlerCoordinator();

			expect(() => {
				handlerCoordinator.initialize(
					{
						config: { agent: "cursor" },
						skipVerification: false,
					},
					createMockCallbacks(),
				);
			}).not.toThrow();
		});

		test("can be initialized multiple times (reinitializes)", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			expect(() => {
				handlerCoordinator.initialize(
					{
						config: { agent: "cursor" },
						skipVerification: true,
					},
					createMockCallbacks(),
				);
			}).not.toThrow();
		});
	});

	describe("getIsVerifying", () => {
		test("returns false when not initialized", () => {
			const handlerCoordinator = createHandlerCoordinator();

			expect(handlerCoordinator.getIsVerifying()).toBe(false);
		});

		test("returns false after initialization with no verification running", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			expect(handlerCoordinator.getIsVerifying()).toBe(false);
		});
	});

	describe("cleanup", () => {
		test("cleans up without errors when not initialized", () => {
			const handlerCoordinator = createHandlerCoordinator();

			expect(() => {
				handlerCoordinator.cleanup();
			}).not.toThrow();
		});

		test("cleans up after initialization", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			expect(() => {
				handlerCoordinator.cleanup();
			}).not.toThrow();

			expect(handlerCoordinator.getIsVerifying()).toBe(false);
		});

		test("can be called multiple times safely", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			handlerCoordinator.cleanup();
			handlerCoordinator.cleanup();
			handlerCoordinator.cleanup();

			expect(handlerCoordinator.getIsVerifying()).toBe(false);
		});
	});

	describe("event subscriptions", () => {
		test("subscribes to agent:complete event on initialization", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			expect(eventBus.getListenerCount("agent:complete")).toBeGreaterThan(0);
		});

		test("subscribes to agent:error event on initialization", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			expect(eventBus.getListenerCount("agent:error")).toBeGreaterThan(0);
		});

		test("unsubscribes from events on cleanup", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			const completeListenersBefore = eventBus.getListenerCount("agent:complete");
			const errorListenersBefore = eventBus.getListenerCount("agent:error");

			handlerCoordinator.cleanup();

			expect(eventBus.getListenerCount("agent:complete")).toBeLessThan(completeListenersBefore);
			expect(eventBus.getListenerCount("agent:error")).toBeLessThan(errorListenersBefore);
		});
	});

	describe("agent:complete event handling", () => {
		test("calls onIterationComplete when agent completes without decomposition", async () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: true,
				},
				createMockCallbacks(),
			);

			eventBus.emit("agent:complete", {
				isComplete: true,
				exitCode: 0,
				outputLength: 100,
				outputPreview: "Task completed",
				retryCount: 0,
				hasDecompositionRequest: false,
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(iterationCompleteCalls.length).toBeGreaterThan(0);
		});
	});

	describe("agent:error event handling", () => {
		test("handles fatal error and calls callbacks", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			eventBus.emit("agent:error", {
				error: "Fatal test error",
				exitCode: 1,
				isFatal: true,
			});

			expect(fatalErrorCalls.length).toBe(1);
			expect(fatalErrorCalls[0]?.error).toBe("Fatal test error");
			expect(appStateChanges).toContain("error");
		});

		test("does not call fatal error callbacks for non-fatal errors", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: false,
				},
				createMockCallbacks(),
			);

			eventBus.emit("agent:error", {
				error: "Non-fatal error",
				exitCode: 1,
				isFatal: false,
			});

			expect(fatalErrorCalls.length).toBe(0);
		});
	});

	describe("state isolation", () => {
		test("multiple coordinators have independent state", () => {
			const coordinator1 = createHandlerCoordinator();
			const coordinator2 = createHandlerCoordinator();

			let coordinator1Calls = 0;
			let _coordinator2Calls = 0;

			coordinator1.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: true,
				},
				{
					...createMockCallbacks(),
					onIterationComplete: () => {
						coordinator1Calls++;
					},
				},
			);

			coordinator2.initialize(
				{
					config: { agent: "cursor" },
					skipVerification: true,
				},
				{
					...createMockCallbacks(),
					onIterationComplete: () => {
						_coordinator2Calls++;
					},
				},
			);

			coordinator1.cleanup();

			eventBus.emit("agent:complete", {
				isComplete: true,
				exitCode: 0,
				outputLength: 100,
				outputPreview: "Done",
				retryCount: 0,
				hasDecompositionRequest: false,
			});

			expect(coordinator1Calls).toBe(0);
		});
	});

	describe("verification configuration", () => {
		test("respects skipVerification option", () => {
			const handlerCoordinator = createHandlerCoordinator();

			handlerCoordinator.initialize(
				{
					config: {
						agent: "cursor",
						verification: { enabled: true, failOnWarning: false },
					},
					skipVerification: true,
				},
				createMockCallbacks(),
			);

			expect(handlerCoordinator.getIsVerifying()).toBe(false);
		});
	});
});
