import type { Prd, PrdTask } from "@/lib/services/index.ts";

export interface DependencyValidationResult {
	isValid: boolean;
	errors: DependencyError[];
}

export interface DependencyError {
	type: "missing_dependency" | "cycle" | "self_reference" | "missing_id";
	taskId?: string;
	taskTitle: string;
	details: string;
}

export interface TaskWithDependencyInfo {
	task: PrdTask;
	index: number;
	dependencyIds: string[];
	isReady: boolean;
	blockedBy: string[];
}

export interface DependencyGraph {
	nodes: Map<string, TaskNode>;
	edges: Map<string, Set<string>>;
	reverseEdges: Map<string, Set<string>>;
}

interface TaskNode {
	task: PrdTask;
	index: number;
}

function buildTaskIdIndex(tasks: PrdTask[]): Map<string, number> {
	const idIndex = new Map<string, number>();

	for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
		const task = tasks.at(taskIndex);

		if (task?.id) {
			idIndex.set(task.id, taskIndex);
		}
	}

	return idIndex;
}

function getTaskIdentifier(task: PrdTask, index: number): string {
	return task.id ?? `__index_${index}`;
}

export function buildDependencyGraph(prd: Prd): DependencyGraph {
	const nodes = new Map<string, TaskNode>();
	const edges = new Map<string, Set<string>>();
	const reverseEdges = new Map<string, Set<string>>();

	for (let taskIndex = 0; taskIndex < prd.tasks.length; taskIndex++) {
		const task = prd.tasks.at(taskIndex);

		if (!task) {
			continue;
		}

		const nodeId = getTaskIdentifier(task, taskIndex);

		nodes.set(nodeId, { task, index: taskIndex });
		edges.set(nodeId, new Set());
		reverseEdges.set(nodeId, new Set());
	}

	for (let taskIndex = 0; taskIndex < prd.tasks.length; taskIndex++) {
		const task = prd.tasks.at(taskIndex);

		if (!task?.dependsOn) {
			continue;
		}

		const nodeId = getTaskIdentifier(task, taskIndex);

		for (const dependencyId of task.dependsOn) {
			if (nodes.has(dependencyId)) {
				edges.get(nodeId)?.add(dependencyId);
				reverseEdges.get(dependencyId)?.add(nodeId);
			}
		}
	}

	return { nodes, edges, reverseEdges };
}

export function validateDependencies(prd: Prd): DependencyValidationResult {
	const errors: DependencyError[] = [];
	const taskIdIndex = buildTaskIdIndex(prd.tasks);

	for (let taskIndex = 0; taskIndex < prd.tasks.length; taskIndex++) {
		const task = prd.tasks.at(taskIndex);

		if (!task?.dependsOn) {
			continue;
		}

		if (task.dependsOn.length > 0 && !task.id) {
			errors.push({
				type: "missing_id",
				taskTitle: task.title,
				details: "Task has dependencies but no id field",
			});
		}

		for (const dependencyId of task.dependsOn) {
			if (task.id && dependencyId === task.id) {
				errors.push({
					type: "self_reference",
					taskId: task.id,
					taskTitle: task.title,
					details: `Task "${task.title}" depends on itself`,
				});

				continue;
			}

			if (!taskIdIndex.has(dependencyId)) {
				errors.push({
					type: "missing_dependency",
					taskId: task.id,
					taskTitle: task.title,
					details: `Task "${task.title}" depends on non-existent task with id "${dependencyId}"`,
				});
			}
		}
	}

	const cycleResult = detectCycles(prd);

	if (cycleResult.hasCycle) {
		errors.push({
			type: "cycle",
			taskTitle: cycleResult.cycleNodes.at(0) ?? "unknown",
			details: `Dependency cycle detected: ${cycleResult.cycleNodes.join(" -> ")}`,
		});
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

interface CycleDetectionResult {
	hasCycle: boolean;
	cycleNodes: string[];
}

export function detectCycles(prd: Prd): CycleDetectionResult {
	const graph = buildDependencyGraph(prd);
	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const path: string[] = [];

	function dfs(nodeId: string): CycleDetectionResult {
		visited.add(nodeId);
		recursionStack.add(nodeId);
		path.push(nodeId);

		const dependencies = graph.edges.get(nodeId) ?? new Set();

		for (const dependencyId of dependencies) {
			if (!visited.has(dependencyId)) {
				const cycleResult = dfs(dependencyId);

				if (cycleResult.hasCycle) {
					return cycleResult;
				}
			} else if (recursionStack.has(dependencyId)) {
				const cycleStartIndex = path.indexOf(dependencyId);
				const cycleNodes = [...path.slice(cycleStartIndex), dependencyId];

				return { hasCycle: true, cycleNodes };
			}
		}

		path.pop();
		recursionStack.delete(nodeId);

		return { hasCycle: false, cycleNodes: [] };
	}

	for (const nodeId of graph.nodes.keys()) {
		if (!visited.has(nodeId)) {
			const cycleResult = dfs(nodeId);

			if (cycleResult.hasCycle) {
				return cycleResult;
			}
		}
	}

	return { hasCycle: false, cycleNodes: [] };
}

export function getTopologicalOrder(prd: Prd): PrdTask[] {
	const graph = buildDependencyGraph(prd);
	const visited = new Set<string>();
	const sortedTasks: PrdTask[] = [];

	function visit(nodeId: string): void {
		if (visited.has(nodeId)) {
			return;
		}

		visited.add(nodeId);

		const dependencies = graph.edges.get(nodeId) ?? new Set();

		for (const dependencyId of dependencies) {
			visit(dependencyId);
		}

		const node = graph.nodes.get(nodeId);

		if (node) {
			sortedTasks.push(node.task);
		}
	}

	for (const nodeId of graph.nodes.keys()) {
		visit(nodeId);
	}

	return sortedTasks;
}

export function getReadyTasks(prd: Prd): TaskWithDependencyInfo[] {
	const graph = buildDependencyGraph(prd);
	const readyTasks: TaskWithDependencyInfo[] = [];

	for (const [nodeId, node] of graph.nodes) {
		if (node.task.done) {
			continue;
		}

		const dependencies = graph.edges.get(nodeId) ?? new Set();
		const blockedBy: string[] = [];

		for (const dependencyId of dependencies) {
			const dependencyNode = graph.nodes.get(dependencyId);

			if (dependencyNode && !dependencyNode.task.done) {
				blockedBy.push(dependencyNode.task.title);
			}
		}

		const isReady = blockedBy.length === 0;

		readyTasks.push({
			task: node.task,
			index: node.index,
			dependencyIds: [...dependencies],
			isReady,
			blockedBy,
		});
	}

	return readyTasks.filter((taskInfo) => taskInfo.isReady);
}

export function getAllTasksWithDependencyInfo(prd: Prd): TaskWithDependencyInfo[] {
	const graph = buildDependencyGraph(prd);
	const tasksWithInfo: TaskWithDependencyInfo[] = [];

	for (const [nodeId, node] of graph.nodes) {
		const dependencies = graph.edges.get(nodeId) ?? new Set();
		const blockedBy: string[] = [];

		for (const dependencyId of dependencies) {
			const dependencyNode = graph.nodes.get(dependencyId);

			if (dependencyNode && !dependencyNode.task.done) {
				blockedBy.push(dependencyNode.task.title);
			}
		}

		const isReady = node.task.done || blockedBy.length === 0;

		tasksWithInfo.push({
			task: node.task,
			index: node.index,
			dependencyIds: [...dependencies],
			isReady,
			blockedBy,
		});
	}

	return tasksWithInfo.sort((a, b) => a.index - b.index);
}

export function getBlockedTasks(prd: Prd): TaskWithDependencyInfo[] {
	return getAllTasksWithDependencyInfo(prd).filter(
		(taskInfo) => !taskInfo.task.done && !taskInfo.isReady,
	);
}

export function getDependents(prd: Prd, taskId: string): PrdTask[] {
	const graph = buildDependencyGraph(prd);
	const dependents = graph.reverseEdges.get(taskId) ?? new Set();
	const dependentTasks: PrdTask[] = [];

	for (const dependentId of dependents) {
		const node = graph.nodes.get(dependentId);

		if (node) {
			dependentTasks.push(node.task);
		}
	}

	return dependentTasks;
}

export function getDependencies(prd: Prd, taskId: string): PrdTask[] {
	const graph = buildDependencyGraph(prd);
	const dependencies = graph.edges.get(taskId) ?? new Set();
	const dependencyTasks: PrdTask[] = [];

	for (const dependencyId of dependencies) {
		const node = graph.nodes.get(dependencyId);

		if (node) {
			dependencyTasks.push(node.task);
		}
	}

	return dependencyTasks;
}

export function getNextReadyTask(prd: Prd): TaskWithDependencyInfo | null {
	const readyTasks = getReadyTasks(prd);

	if (readyTasks.length === 0) {
		return null;
	}

	const sortedByPriority = readyTasks.sort((a, b) => {
		const priorityA = a.task.priority ?? Number.MAX_SAFE_INTEGER;
		const priorityB = b.task.priority ?? Number.MAX_SAFE_INTEGER;

		if (priorityA !== priorityB) {
			return priorityA - priorityB;
		}

		return a.index - b.index;
	});

	return sortedByPriority.at(0) ?? null;
}

export function canExecuteTask(prd: Prd, taskId: string): { canExecute: boolean; reason?: string } {
	const graph = buildDependencyGraph(prd);
	const node = graph.nodes.get(taskId);

	if (!node) {
		return { canExecute: false, reason: `Task with id "${taskId}" not found` };
	}

	if (node.task.done) {
		return { canExecute: false, reason: "Task is already completed" };
	}

	const dependencies = graph.edges.get(taskId) ?? new Set();
	const incompleteDependencies: string[] = [];

	for (const dependencyId of dependencies) {
		const dependencyNode = graph.nodes.get(dependencyId);

		if (dependencyNode && !dependencyNode.task.done) {
			incompleteDependencies.push(dependencyNode.task.title);
		}
	}

	if (incompleteDependencies.length > 0) {
		return {
			canExecute: false,
			reason: `Task is blocked by incomplete dependencies: ${incompleteDependencies.join(", ")}`,
		};
	}

	return { canExecute: true };
}

export function getExecutionOrder(prd: Prd): PrdTask[] {
	const topologicalOrder = getTopologicalOrder(prd);

	return topologicalOrder.filter((task) => !task.done);
}

export function getParallelExecutionGroups(prd: Prd): PrdTask[][] {
	const groups: PrdTask[][] = [];
	const completed = new Set<string>();

	const incompleteTasks = prd.tasks.filter((task) => !task.done);
	const taskIdIndex = buildTaskIdIndex(prd.tasks);

	for (const task of prd.tasks) {
		if (task.done && task.id) {
			completed.add(task.id);
		}
	}

	let remainingTasks = [...incompleteTasks];

	while (remainingTasks.length > 0) {
		const readyInThisRound: PrdTask[] = [];

		for (const task of remainingTasks) {
			const dependencies = task.dependsOn ?? [];
			const isAllDependenciesMet = dependencies.every((depId) => {
				if (completed.has(depId)) {
					return true;
				}

				const depIndex = taskIdIndex.get(depId);

				if (depIndex === undefined) {
					return true;
				}

				const depTask = prd.tasks.at(depIndex);

				return depTask?.done === true;
			});

			if (isAllDependenciesMet) {
				readyInThisRound.push(task);
			}
		}

		if (readyInThisRound.length === 0 && remainingTasks.length > 0) {
			break;
		}

		const sortedGroup = readyInThisRound.sort((a, b) => {
			const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
			const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;

			return priorityA - priorityB;
		});

		groups.push(sortedGroup);

		for (const task of readyInThisRound) {
			if (task.id) {
				completed.add(task.id);
			}
		}

		const readyIds = new Set(readyInThisRound.map((t) => t.id).filter(Boolean));
		const readyTitles = new Set(readyInThisRound.map((t) => t.title));

		remainingTasks = remainingTasks.filter((t) => !readyIds.has(t.id) && !readyTitles.has(t.title));
	}

	return groups;
}
