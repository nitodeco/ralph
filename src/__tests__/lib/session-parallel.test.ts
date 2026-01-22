import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";
import { createSessionService } from "@/lib/services/session/implementation.ts";

const TEST_DIR = join(tmpdir(), `ralph-test-session-parallel-${Date.now()}`);
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

describe("session parallel execution", () => {
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

		bootstrapTestServices({ projectRegistry: projectRegistryService });

		process.chdir(TEST_DIR);
		sessionService = createSessionService();
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

	describe("enableParallelMode", () => {
		test("enables parallel mode with correct initial state", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(parallelSession.parallelState).toBeDefined();
			expect(parallelSession.parallelState?.isParallelMode).toBe(true);
			expect(parallelSession.parallelState?.currentGroupIndex).toBe(-1);
			expect(parallelSession.parallelState?.executionGroups).toEqual([]);
			expect(parallelSession.parallelState?.activeExecutions).toEqual([]);
			expect(parallelSession.parallelState?.maxConcurrentTasks).toBe(4);
		});

		test("updates lastUpdateTime", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(parallelSession.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});
	});

	describe("disableParallelMode", () => {
		test("removes parallel state from session", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const disabledSession = sessionService.disableParallelMode(parallelSession);

			expect(disabledSession.parallelState).toBeUndefined();
		});

		test("preserves other session fields", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const disabledSession = sessionService.disableParallelMode(parallelSession);

			expect(disabledSession.totalIterations).toBe(10);
			expect(disabledSession.currentIteration).toBe(0);
			expect(disabledSession.status).toBe("running");
		});
	});

	describe("isParallelMode", () => {
		test("returns false for session without parallel state", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.isParallelMode(session)).toBe(false);
		});

		test("returns true for session with parallel mode enabled", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(sessionService.isParallelMode(parallelSession)).toBe(true);
		});
	});

	describe("startParallelGroup", () => {
		test("creates new execution group", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);

			expect(withGroup.parallelState?.executionGroups).toHaveLength(1);
			expect(withGroup.parallelState?.executionGroups.at(0)?.groupIndex).toBe(0);
			expect(withGroup.parallelState?.executionGroups.at(0)?.isComplete).toBe(false);
			expect(withGroup.parallelState?.currentGroupIndex).toBe(0);
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.startParallelGroup(session, 0);

			expect(result).toEqual(session);
		});

		test("can create multiple groups", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup1 = sessionService.startParallelGroup(parallelSession, 0);
			const withGroup2 = sessionService.startParallelGroup(withGroup1, 1);

			expect(withGroup2.parallelState?.executionGroups).toHaveLength(2);
			expect(withGroup2.parallelState?.currentGroupIndex).toBe(1);
		});
	});

	describe("completeParallelGroup", () => {
		test("marks group as complete", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const completed = sessionService.completeParallelGroup(withGroup, 0);

			expect(completed.parallelState?.executionGroups.at(0)?.isComplete).toBe(true);
			expect(completed.parallelState?.executionGroups.at(0)?.endTime).toBeGreaterThan(0);
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.completeParallelGroup(session, 0);

			expect(result).toEqual(session);
		});
	});

	describe("getCurrentParallelGroup", () => {
		test("returns null if not in parallel mode", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.getCurrentParallelGroup(session)).toBeNull();
		});

		test("returns null if no groups started", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(sessionService.getCurrentParallelGroup(parallelSession)).toBeNull();
		});

		test("returns current incomplete group", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const currentGroup = sessionService.getCurrentParallelGroup(withGroup);

			expect(currentGroup).not.toBeNull();
			expect(currentGroup?.groupIndex).toBe(0);
			expect(currentGroup?.isComplete).toBe(false);
		});

		test("returns null if current group is complete", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const completed = sessionService.completeParallelGroup(withGroup, 0);

			expect(sessionService.getCurrentParallelGroup(completed)).toBeNull();
		});
	});

	describe("startTaskExecution", () => {
		test("adds task to active executions", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});

			expect(withTask.parallelState?.activeExecutions).toHaveLength(1);
			expect(withTask.parallelState?.activeExecutions.at(0)?.taskId).toBe("task-1");
			expect(withTask.parallelState?.activeExecutions.at(0)?.status).toBe("running");
		});

		test("adds task to current group", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});

			expect(withTask.parallelState?.executionGroups.at(0)?.taskExecutions).toHaveLength(1);
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.startTaskExecution(session, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});

			expect(result).toEqual(session);
		});

		test("can start multiple task executions", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask1 = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task 1",
				taskIndex: 0,
				processId: "proc-1",
			});
			const withTask2 = sessionService.startTaskExecution(withTask1, {
				taskId: "task-2",
				taskTitle: "Test Task 2",
				taskIndex: 1,
				processId: "proc-2",
			});

			expect(withTask2.parallelState?.activeExecutions).toHaveLength(2);
		});
	});

	describe("completeTaskExecution", () => {
		test("marks task as completed successfully", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const completed = sessionService.completeTaskExecution(withTask, "task-1", true);
			const execution = completed.parallelState?.activeExecutions.at(0);

			expect(execution?.status).toBe("completed");
			expect(execution?.endTime).toBeGreaterThan(0);
		});

		test("marks task as failed when not successful", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const failed = sessionService.completeTaskExecution(withTask, "task-1", false);

			expect(failed.parallelState?.activeExecutions.at(0)?.status).toBe("failed");
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.completeTaskExecution(session, "task-1", true);

			expect(result).toEqual(session);
		});
	});

	describe("failTaskExecution", () => {
		test("marks task as failed with error message", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const failed = sessionService.failTaskExecution(withTask, "task-1", "Test error message");
			const execution = failed.parallelState?.activeExecutions.at(0);

			expect(execution?.status).toBe("failed");
			expect(execution?.lastError).toBe("Test error message");
			expect(execution?.endTime).toBeGreaterThan(0);
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.failTaskExecution(session, "task-1", "error");

			expect(result).toEqual(session);
		});
	});

	describe("retryTaskExecution", () => {
		test("resets task to running with incremented retry count", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const failed = sessionService.failTaskExecution(withTask, "task-1", "Test error");
			const retried = sessionService.retryTaskExecution(failed, "task-1");
			const execution = retried.parallelState?.activeExecutions.at(0);

			expect(execution?.status).toBe("running");
			expect(execution?.retryCount).toBe(1);
			expect(execution?.lastError).toBeNull();
			expect(execution?.endTime).toBeNull();
		});

		test("returns session unchanged if not in parallel mode", () => {
			const session = sessionService.create(10, 0);
			const result = sessionService.retryTaskExecution(session, "task-1");

			expect(result).toEqual(session);
		});
	});

	describe("getActiveExecutions", () => {
		test("returns empty array if not in parallel mode", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.getActiveExecutions(session)).toEqual([]);
		});

		test("returns only running executions", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask1 = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task 1",
				taskIndex: 0,
				processId: "proc-1",
			});
			const withTask2 = sessionService.startTaskExecution(withTask1, {
				taskId: "task-2",
				taskTitle: "Test Task 2",
				taskIndex: 1,
				processId: "proc-2",
			});
			const withCompleted = sessionService.completeTaskExecution(withTask2, "task-1", true);
			const activeExecutions = sessionService.getActiveExecutions(withCompleted);

			expect(activeExecutions).toHaveLength(1);
			expect(activeExecutions.at(0)?.taskId).toBe("task-2");
		});
	});

	describe("getTaskExecution", () => {
		test("returns null if not in parallel mode", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.getTaskExecution(session, "task-1")).toBeNull();
		});

		test("returns null if task not found", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(sessionService.getTaskExecution(parallelSession, "task-1")).toBeNull();
		});

		test("returns execution for existing task", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const execution = sessionService.getTaskExecution(withTask, "task-1");

			expect(execution).not.toBeNull();
			expect(execution?.taskId).toBe("task-1");
		});
	});

	describe("isTaskExecuting", () => {
		test("returns false if not in parallel mode", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.isTaskExecuting(session, "task-1")).toBe(false);
		});

		test("returns false if task not found", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);

			expect(sessionService.isTaskExecuting(parallelSession, "task-1")).toBe(false);
		});

		test("returns true if task is running", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});

			expect(sessionService.isTaskExecuting(withTask, "task-1")).toBe(true);
		});

		test("returns false if task is completed", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});
			const completed = sessionService.completeTaskExecution(withTask, "task-1", true);

			expect(sessionService.isTaskExecuting(completed, "task-1")).toBe(false);
		});
	});

	describe("getActiveExecutionCount", () => {
		test("returns 0 if not in parallel mode", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.getActiveExecutionCount(session)).toBe(0);
		});

		test("returns correct count of running executions", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask1 = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task 1",
				taskIndex: 0,
				processId: "proc-1",
			});
			const withTask2 = sessionService.startTaskExecution(withTask1, {
				taskId: "task-2",
				taskTitle: "Test Task 2",
				taskIndex: 1,
				processId: "proc-2",
			});

			expect(sessionService.getActiveExecutionCount(withTask2)).toBe(2);

			const withCompleted = sessionService.completeTaskExecution(withTask2, "task-1", true);

			expect(sessionService.getActiveExecutionCount(withCompleted)).toBe(1);
		});
	});

	describe("save and load with parallel state", () => {
		test("persists and loads session with parallel state correctly", () => {
			const session = sessionService.create(10, 0);
			const parallelSession = sessionService.enableParallelMode(session, 4);
			const withGroup = sessionService.startParallelGroup(parallelSession, 0);
			const withTask = sessionService.startTaskExecution(withGroup, {
				taskId: "task-1",
				taskTitle: "Test Task",
				taskIndex: 0,
				processId: "proc-1",
			});

			sessionService.save(withTask);
			const loaded = sessionService.load();

			expect(loaded).not.toBeNull();
			expect(loaded?.parallelState).toBeDefined();
			expect(loaded?.parallelState?.isParallelMode).toBe(true);
			expect(loaded?.parallelState?.maxConcurrentTasks).toBe(4);
			expect(loaded?.parallelState?.executionGroups).toHaveLength(1);
			expect(loaded?.parallelState?.activeExecutions).toHaveLength(1);
		});

		test("loads session without parallel state correctly", () => {
			const session = sessionService.create(10, 0);

			sessionService.save(session);
			const loaded = sessionService.load();

			expect(loaded).not.toBeNull();
			expect(loaded?.parallelState).toBeUndefined();
		});
	});
});
