import { describe, expect, test } from "bun:test";
import {
	buildDependencyGraph,
	canExecuteTask,
	detectCycles,
	getAllTasksWithDependencyInfo,
	getBlockedTasks,
	getDependencies,
	getDependents,
	getExecutionOrder,
	getNextReadyTask,
	getParallelExecutionGroups,
	getReadyTasks,
	getTopologicalOrder,
	validateDependencies,
} from "@/lib/dependency-graph.ts";
import type { Prd, PrdTask } from "@/types.ts";

function createTask(overrides: Partial<PrdTask> = {}): PrdTask {
	return {
		title: "Test Task",
		description: "Test description",
		steps: ["Step 1"],
		done: false,
		...overrides,
	};
}

function createPrd(tasks: PrdTask[]): Prd {
	return {
		project: "Test Project",
		tasks,
	};
}

describe("buildDependencyGraph", () => {
	test("creates empty graph for empty tasks", () => {
		const prd = createPrd([]);
		const graph = buildDependencyGraph(prd);

		expect(graph.nodes.size).toBe(0);
		expect(graph.edges.size).toBe(0);
	});

	test("creates graph nodes for all tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const graph = buildDependencyGraph(prd);

		expect(graph.nodes.size).toBe(2);
		expect(graph.nodes.has("task-1")).toBe(true);
		expect(graph.nodes.has("task-2")).toBe(true);
	});

	test("creates edges for dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const graph = buildDependencyGraph(prd);

		expect(graph.edges.get("task-2")?.has("task-1")).toBe(true);
	});

	test("creates reverse edges for dependents", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const graph = buildDependencyGraph(prd);

		expect(graph.reverseEdges.get("task-1")?.has("task-2")).toBe(true);
	});

	test("handles tasks without ids using index-based identifiers", () => {
		const prd = createPrd([createTask({ title: "Task 1" }), createTask({ title: "Task 2" })]);
		const graph = buildDependencyGraph(prd);

		expect(graph.nodes.size).toBe(2);
		expect(graph.nodes.has("__index_0")).toBe(true);
		expect(graph.nodes.has("__index_1")).toBe(true);
	});
});

describe("validateDependencies", () => {
	test("returns valid for tasks without dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = validateDependencies(prd);

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("returns valid for tasks with valid dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = validateDependencies(prd);

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("detects missing dependency", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", dependsOn: ["non-existent"] }),
		]);
		const result = validateDependencies(prd);

		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.type === "missing_dependency")).toBe(true);
	});

	test("detects self-reference", () => {
		const prd = createPrd([createTask({ id: "task-1", title: "Task 1", dependsOn: ["task-1"] })]);
		const result = validateDependencies(prd);

		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.type === "self_reference")).toBe(true);
	});

	test("detects missing id when task has dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = validateDependencies(prd);

		expect(result.isValid).toBe(false);
		expect(result.errors.some((e) => e.type === "missing_id")).toBe(true);
	});
});

describe("detectCycles", () => {
	test("returns no cycle for empty graph", () => {
		const prd = createPrd([]);
		const result = detectCycles(prd);

		expect(result.hasCycle).toBe(false);
	});

	test("returns no cycle for linear dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-2"] }),
		]);
		const result = detectCycles(prd);

		expect(result.hasCycle).toBe(false);
	});

	test("detects direct cycle between two tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", dependsOn: ["task-2"] }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = detectCycles(prd);

		expect(result.hasCycle).toBe(true);
		expect(result.cycleNodes.length).toBeGreaterThan(0);
	});

	test("detects indirect cycle through multiple tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", dependsOn: ["task-3"] }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-2"] }),
		]);
		const result = detectCycles(prd);

		expect(result.hasCycle).toBe(true);
	});

	test("returns no cycle for diamond dependency pattern", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-1"] }),
			createTask({ id: "task-4", title: "Task 4", dependsOn: ["task-2", "task-3"] }),
		]);
		const result = detectCycles(prd);

		expect(result.hasCycle).toBe(false);
	});
});

describe("getTopologicalOrder", () => {
	test("returns empty array for empty tasks", () => {
		const prd = createPrd([]);
		const result = getTopologicalOrder(prd);

		expect(result).toHaveLength(0);
	});

	test("returns tasks in dependency order", () => {
		const prd = createPrd([
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-2"] }),
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getTopologicalOrder(prd);
		const titles = result.map((t) => t.title);

		expect(titles.indexOf("Task 1")).toBeLessThan(titles.indexOf("Task 2"));
		expect(titles.indexOf("Task 2")).toBeLessThan(titles.indexOf("Task 3"));
	});

	test("handles independent tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
			createTask({ id: "task-3", title: "Task 3" }),
		]);
		const result = getTopologicalOrder(prd);

		expect(result).toHaveLength(3);
	});
});

describe("getReadyTasks", () => {
	test("returns empty array for empty tasks", () => {
		const prd = createPrd([]);
		const result = getReadyTasks(prd);

		expect(result).toHaveLength(0);
	});

	test("returns all tasks when no dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getReadyTasks(prd);

		expect(result).toHaveLength(2);
	});

	test("excludes completed tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", done: true }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getReadyTasks(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.task.title).toBe("Task 2");
	});

	test("excludes tasks with incomplete dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getReadyTasks(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.task.title).toBe("Task 1");
	});

	test("includes tasks when dependencies are complete", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", done: true }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getReadyTasks(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.task.title).toBe("Task 2");
	});
});

describe("getAllTasksWithDependencyInfo", () => {
	test("returns all tasks with dependency info", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getAllTasksWithDependencyInfo(prd);

		expect(result).toHaveLength(2);
		expect(result.at(0)?.isReady).toBe(true);
		expect(result.at(1)?.isReady).toBe(false);
		expect(result.at(1)?.blockedBy).toContain("Task 1");
	});

	test("returns tasks sorted by index", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
			createTask({ id: "task-3", title: "Task 3" }),
		]);
		const result = getAllTasksWithDependencyInfo(prd);

		expect(result.at(0)?.index).toBe(0);
		expect(result.at(1)?.index).toBe(1);
		expect(result.at(2)?.index).toBe(2);
	});
});

describe("getBlockedTasks", () => {
	test("returns empty array when no blocked tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getBlockedTasks(prd);

		expect(result).toHaveLength(0);
	});

	test("returns tasks blocked by dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getBlockedTasks(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.task.title).toBe("Task 2");
	});

	test("excludes completed tasks from blocked list", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"], done: true }),
		]);
		const result = getBlockedTasks(prd);

		expect(result).toHaveLength(0);
	});
});

describe("getDependents", () => {
	test("returns empty array for task with no dependents", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getDependents(prd, "task-1");

		expect(result).toHaveLength(0);
	});

	test("returns tasks that depend on given task", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-1"] }),
		]);
		const result = getDependents(prd, "task-1");

		expect(result).toHaveLength(2);
		expect(result.map((t) => t.title)).toContain("Task 2");
		expect(result.map((t) => t.title)).toContain("Task 3");
	});
});

describe("getDependencies", () => {
	test("returns empty array for task with no dependencies", () => {
		const prd = createPrd([createTask({ id: "task-1", title: "Task 1" })]);
		const result = getDependencies(prd, "task-1");

		expect(result).toHaveLength(0);
	});

	test("returns dependencies for task", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-1", "task-2"] }),
		]);
		const result = getDependencies(prd, "task-3");

		expect(result).toHaveLength(2);
		expect(result.map((t) => t.title)).toContain("Task 1");
		expect(result.map((t) => t.title)).toContain("Task 2");
	});
});

describe("getNextReadyTask", () => {
	test("returns null for empty tasks", () => {
		const prd = createPrd([]);
		const result = getNextReadyTask(prd);

		expect(result).toBeNull();
	});

	test("returns null when all tasks are done", () => {
		const prd = createPrd([createTask({ id: "task-1", title: "Task 1", done: true })]);
		const result = getNextReadyTask(prd);

		expect(result).toBeNull();
	});

	test("returns first ready task by index when no priority", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getNextReadyTask(prd);

		expect(result?.task.title).toBe("Task 1");
	});

	test("returns highest priority ready task", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", priority: 2 }),
			createTask({ id: "task-2", title: "Task 2", priority: 1 }),
		]);
		const result = getNextReadyTask(prd);

		expect(result?.task.title).toBe("Task 2");
	});

	test("skips blocked tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", priority: 2 }),
			createTask({ id: "task-2", title: "Task 2", priority: 1, dependsOn: ["task-1"] }),
		]);
		const result = getNextReadyTask(prd);

		expect(result?.task.title).toBe("Task 1");
	});
});

describe("canExecuteTask", () => {
	test("returns false for non-existent task", () => {
		const prd = createPrd([]);
		const result = canExecuteTask(prd, "non-existent");

		expect(result.canExecute).toBe(false);
		expect(result.reason).toContain("not found");
	});

	test("returns false for completed task", () => {
		const prd = createPrd([createTask({ id: "task-1", title: "Task 1", done: true })]);
		const result = canExecuteTask(prd, "task-1");

		expect(result.canExecute).toBe(false);
		expect(result.reason).toContain("already completed");
	});

	test("returns false for task with incomplete dependencies", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = canExecuteTask(prd, "task-2");

		expect(result.canExecute).toBe(false);
		expect(result.reason).toContain("blocked by incomplete dependencies");
	});

	test("returns true for ready task", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", done: true }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = canExecuteTask(prd, "task-2");

		expect(result.canExecute).toBe(true);
	});
});

describe("getExecutionOrder", () => {
	test("returns empty array for empty tasks", () => {
		const prd = createPrd([]);
		const result = getExecutionOrder(prd);

		expect(result).toHaveLength(0);
	});

	test("excludes completed tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", done: true }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getExecutionOrder(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.title).toBe("Task 2");
	});

	test("returns tasks in dependency order", () => {
		const prd = createPrd([
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-1", title: "Task 1" }),
		]);
		const result = getExecutionOrder(prd);
		const titles = result.map((t) => t.title);

		expect(titles.indexOf("Task 1")).toBeLessThan(titles.indexOf("Task 2"));
	});
});

describe("getParallelExecutionGroups", () => {
	test("returns empty array for empty tasks", () => {
		const prd = createPrd([]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(0);
	});

	test("returns single group for independent tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2" }),
		]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)).toHaveLength(2);
	});

	test("returns multiple groups for dependent tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(2);
		expect(result.at(0)?.at(0)?.title).toBe("Task 1");
		expect(result.at(1)?.at(0)?.title).toBe("Task 2");
	});

	test("groups parallel tasks together", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1" }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
			createTask({ id: "task-3", title: "Task 3", dependsOn: ["task-1"] }),
			createTask({ id: "task-4", title: "Task 4", dependsOn: ["task-2", "task-3"] }),
		]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(3);
		expect(result.at(0)?.map((t) => t.title)).toEqual(["Task 1"]);
		expect(
			result
				.at(1)
				?.map((t) => t.title)
				.sort(),
		).toEqual(["Task 2", "Task 3"]);
		expect(result.at(2)?.map((t) => t.title)).toEqual(["Task 4"]);
	});

	test("excludes completed tasks", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", done: true }),
			createTask({ id: "task-2", title: "Task 2", dependsOn: ["task-1"] }),
		]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.at(0)?.title).toBe("Task 2");
	});

	test("sorts within group by priority", () => {
		const prd = createPrd([
			createTask({ id: "task-1", title: "Task 1", priority: 3 }),
			createTask({ id: "task-2", title: "Task 2", priority: 1 }),
			createTask({ id: "task-3", title: "Task 3", priority: 2 }),
		]);
		const result = getParallelExecutionGroups(prd);

		expect(result).toHaveLength(1);
		expect(result.at(0)?.at(0)?.title).toBe("Task 2");
		expect(result.at(0)?.at(1)?.title).toBe("Task 3");
		expect(result.at(0)?.at(2)?.title).toBe("Task 1");
	});
});
