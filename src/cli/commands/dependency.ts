import {
	buildDependencyGraph,
	canExecuteTask,
	type DependencyError,
	getAllTasksWithDependencyInfo,
	getBlockedTasks,
	getDependencies,
	getDependents,
	getParallelExecutionGroups,
	getReadyTasks,
	validateDependencies,
} from "@/lib/dependency-graph.ts";
import { createError, ErrorCode, formatError } from "@/lib/errors.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import type { Prd, PrdTask } from "@/types.ts";

interface DependencyErrorJsonOutput {
	error: string;
	code: string;
	suggestion?: string;
}

interface DependencyGraphJsonOutput {
	tasks: Array<{
		index: number;
		id: string | null;
		title: string;
		status: "done" | "pending";
		priority: number | null;
		dependencies: string[];
		dependents: string[];
		isReady: boolean;
		blockedBy: string[];
	}>;
	summary: {
		total: number;
		withDependencies: number;
		ready: number;
		blocked: number;
	};
}

interface DependencyValidateJsonOutput {
	valid: boolean;
	errors: Array<{
		type: string;
		taskId: string | null;
		taskTitle: string;
		details: string;
	}>;
}

interface DependencyReadyJsonOutput {
	tasks: Array<{
		index: number;
		id: string | null;
		title: string;
		priority: number | null;
	}>;
	count: number;
}

interface DependencyBlockedJsonOutput {
	tasks: Array<{
		index: number;
		id: string | null;
		title: string;
		blockedBy: string[];
	}>;
	count: number;
}

interface DependencyOrderJsonOutput {
	groups: Array<{
		groupIndex: number;
		tasks: Array<{
			index: number;
			id: string | null;
			title: string;
			priority: number | null;
		}>;
	}>;
	totalGroups: number;
	totalTasks: number;
}

interface DependencyShowJsonOutput {
	task: {
		index: number;
		id: string | null;
		title: string;
		status: "done" | "pending";
		priority: number | null;
	};
	dependencies: Array<{
		id: string;
		title: string;
		status: "done" | "pending";
	}>;
	dependents: Array<{
		id: string;
		title: string;
		status: "done" | "pending";
	}>;
	isReady: boolean;
	blockedBy: string[];
}

interface DependencySetJsonOutput {
	success: boolean;
	task: {
		index: number;
		title: string;
	};
	dependencies: string[];
}

interface DependencyRemoveJsonOutput {
	success: boolean;
	task: {
		index: number;
		title: string;
	};
	removedDependency: string;
	remainingDependencies: string[];
}

function handlePrdNotFound(jsonOutput: boolean): void {
	const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD found");

	if (jsonOutput) {
		const output: DependencyErrorJsonOutput = {
			error: error.message,
			code: error.code,
			suggestion: error.suggestion,
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.error(formatError(error));
	}

	process.exit(1);
}

function handleTaskNotFound(identifier: string, jsonOutput: boolean): void {
	const error = createError(ErrorCode.PRD_TASK_NOT_FOUND, `Task not found: "${identifier}"`);

	if (jsonOutput) {
		const output: DependencyErrorJsonOutput = {
			error: error.message,
			code: error.code,
			suggestion: error.suggestion,
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.error(formatError(error));
	}

	process.exit(1);
}

function handleMissingIdentifier(jsonOutput: boolean): void {
	const error = createError(ErrorCode.PRD_TASK_NOT_FOUND, "Task identifier is required");

	if (jsonOutput) {
		const output: DependencyErrorJsonOutput = {
			error: error.message,
			code: error.code,
			suggestion: "Provide a task number (1-based), task title, or task id",
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.error("\x1b[31mError:\x1b[0m Task identifier is required");
		console.log("\nUsage: ralph dependency show <task-number|task-title|task-id>");
	}

	process.exit(1);
}

function getTaskIdentifier(task: PrdTask, index: number): string {
	return task.id ?? `__index_${index}`;
}

function resolveTaskIndex(prd: Prd, identifier: string): number | null {
	const trimmed = identifier.trim();

	if (trimmed === "") {
		return null;
	}

	const parsed = Number.parseInt(trimmed, 10);

	if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= prd.tasks.length) {
		return parsed - 1;
	}

	const normalizedIdentifier = trimmed.toLowerCase();
	const matchingByTitle = prd.tasks.findIndex(
		(task) => task.title.toLowerCase() === normalizedIdentifier,
	);

	if (matchingByTitle !== -1) {
		return matchingByTitle;
	}

	const matchingById = prd.tasks.findIndex((task) => task.id === trimmed);

	if (matchingById !== -1) {
		return matchingById;
	}

	return null;
}

function formatDependencyError(error: DependencyError): string {
	const typeLabels: Record<DependencyError["type"], string> = {
		missing_dependency: "\x1b[31m✗\x1b[0m Missing dependency",
		cycle: "\x1b[31m✗\x1b[0m Dependency cycle",
		self_reference: "\x1b[31m✗\x1b[0m Self-reference",
		missing_id: "\x1b[33m⚠\x1b[0m Missing ID",
	};

	return `${typeLabels[error.type]}: ${error.details}`;
}

export function printDependencyGraph(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const graph = buildDependencyGraph(prd);
	const tasksWithInfo = getAllTasksWithDependencyInfo(prd);
	const readyTasks = getReadyTasks(prd);
	const blockedTasks = getBlockedTasks(prd);

	const tasksWithDependencies = prd.tasks.filter(
		(task) => task.dependsOn && task.dependsOn.length > 0,
	);

	if (jsonOutput) {
		const output: DependencyGraphJsonOutput = {
			tasks: tasksWithInfo.map((info) => {
				const nodeId = getTaskIdentifier(info.task, info.index);
				const dependents = graph.reverseEdges.get(nodeId) ?? new Set();

				return {
					index: info.index + 1,
					id: info.task.id ?? null,
					title: info.task.title,
					status: info.task.done ? "done" : "pending",
					priority: info.task.priority ?? null,
					dependencies: info.dependencyIds,
					dependents: [...dependents],
					isReady: info.isReady,
					blockedBy: info.blockedBy,
				};
			}),
			summary: {
				total: prd.tasks.length,
				withDependencies: tasksWithDependencies.length,
				ready: readyTasks.length,
				blocked: blockedTasks.length,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("Dependency Graph:\n");

	if (prd.tasks.length === 0) {
		console.log("No tasks defined.");

		return;
	}

	for (const info of tasksWithInfo) {
		const statusIcon = info.task.done ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";
		const dimStyle = info.task.done ? "\x1b[2m" : "";
		const resetStyle = "\x1b[0m";
		const idLabel = info.task.id ? ` (${info.task.id})` : "";
		const priorityLabel = info.task.priority !== undefined ? ` P${info.task.priority}` : "";

		console.log(
			`${dimStyle}${statusIcon} [${info.index + 1}] ${info.task.title}${idLabel}${priorityLabel}${resetStyle}`,
		);

		if (info.dependencyIds.length > 0) {
			console.log(`   \x1b[90m└─ depends on: ${info.dependencyIds.join(", ")}\x1b[0m`);
		}

		if (!info.task.done && info.blockedBy.length > 0) {
			console.log(`   \x1b[33m└─ blocked by: ${info.blockedBy.join(", ")}\x1b[0m`);
		}
	}

	console.log(
		`\nTotal: ${prd.tasks.length} | With dependencies: ${tasksWithDependencies.length} | Ready: ${readyTasks.length} | Blocked: ${blockedTasks.length}`,
	);
}

export function printDependencyValidate(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const validationResult = validateDependencies(prd);

	if (jsonOutput) {
		const output: DependencyValidateJsonOutput = {
			valid: validationResult.isValid,
			errors: validationResult.errors.map((error) => ({
				type: error.type,
				taskId: error.taskId ?? null,
				taskTitle: error.taskTitle,
				details: error.details,
			})),
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (validationResult.isValid) {
		console.log("\x1b[32m✓\x1b[0m Dependency validation passed - no errors found");

		return;
	}

	console.log("Dependency Validation Errors:\n");

	for (const error of validationResult.errors) {
		console.log(formatDependencyError(error));
	}

	console.log(`\n\x1b[31m✗\x1b[0m Found ${validationResult.errors.length} error(s)`);

	process.exit(1);
}

export function printDependencyReady(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const readyTasks = getReadyTasks(prd);

	if (jsonOutput) {
		const output: DependencyReadyJsonOutput = {
			tasks: readyTasks.map((info) => ({
				index: info.index + 1,
				id: info.task.id ?? null,
				title: info.task.title,
				priority: info.task.priority ?? null,
			})),
			count: readyTasks.length,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("Ready Tasks (all dependencies satisfied):\n");

	if (readyTasks.length === 0) {
		console.log("No tasks are ready to execute.");
		console.log("\nEither all tasks are completed or there are blocking dependencies.");

		return;
	}

	for (const info of readyTasks) {
		const priorityLabel = info.task.priority !== undefined ? ` (P${info.task.priority})` : "";

		console.log(`  \x1b[90m○\x1b[0m [${info.index + 1}] ${info.task.title}${priorityLabel}`);
	}

	console.log(`\n${readyTasks.length} task(s) ready for execution`);
}

export function printDependencyBlocked(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const blockedTasks = getBlockedTasks(prd);

	if (jsonOutput) {
		const output: DependencyBlockedJsonOutput = {
			tasks: blockedTasks.map((info) => ({
				index: info.index + 1,
				id: info.task.id ?? null,
				title: info.task.title,
				blockedBy: info.blockedBy,
			})),
			count: blockedTasks.length,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("Blocked Tasks (waiting for dependencies):\n");

	if (blockedTasks.length === 0) {
		console.log("No tasks are blocked.");

		return;
	}

	for (const info of blockedTasks) {
		console.log(`  \x1b[33m○\x1b[0m [${info.index + 1}] ${info.task.title}`);
		console.log(`     \x1b[90m└─ blocked by: ${info.blockedBy.join(", ")}\x1b[0m`);
	}

	console.log(`\n${blockedTasks.length} task(s) blocked`);
}

export function printDependencyOrder(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const parallelGroups = getParallelExecutionGroups(prd);
	const totalTasks = parallelGroups.flat().length;

	if (jsonOutput) {
		const output: DependencyOrderJsonOutput = {
			groups: parallelGroups.map((group, groupIndex) => ({
				groupIndex: groupIndex + 1,
				tasks: group.map((task) => {
					const taskIndex = prd.tasks.findIndex((t) => t.title === task.title);

					return {
						index: taskIndex + 1,
						id: task.id ?? null,
						title: task.title,
						priority: task.priority ?? null,
					};
				}),
			})),
			totalGroups: parallelGroups.length,
			totalTasks,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("Parallel Execution Order:\n");

	if (parallelGroups.length === 0) {
		console.log("No pending tasks to execute.");

		return;
	}

	for (const [groupIndex, group] of parallelGroups.entries()) {
		console.log(
			`\x1b[36mGroup ${groupIndex + 1}\x1b[0m (${group.length} task(s) can run in parallel):`,
		);

		for (const task of group) {
			const taskIndex = prd.tasks.findIndex((t) => t.title === task.title);
			const priorityLabel = task.priority !== undefined ? ` (P${task.priority})` : "";

			console.log(`  \x1b[90m○\x1b[0m [${taskIndex + 1}] ${task.title}${priorityLabel}`);
		}

		console.log();
	}

	console.log(`Total: ${parallelGroups.length} group(s), ${totalTasks} task(s)`);
}

export function printDependencyShow(identifier: string, jsonOutput: boolean): void {
	if (!identifier.trim()) {
		handleMissingIdentifier(jsonOutput);

		return;
	}

	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const taskIndex = resolveTaskIndex(prd, identifier);

	if (taskIndex === null) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const task = prd.tasks.at(taskIndex);

	if (!task) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const taskId = getTaskIdentifier(task, taskIndex);
	const dependencies = getDependencies(prd, taskId);
	const dependents = getDependents(prd, taskId);
	const canExecute = canExecuteTask(prd, taskId);
	const tasksWithInfo = getAllTasksWithDependencyInfo(prd);
	const taskInfo = tasksWithInfo.find((info) => info.index === taskIndex);

	if (jsonOutput) {
		const output: DependencyShowJsonOutput = {
			task: {
				index: taskIndex + 1,
				id: task.id ?? null,
				title: task.title,
				status: task.done ? "done" : "pending",
				priority: task.priority ?? null,
			},
			dependencies: dependencies.map((dep) => ({
				id: dep.id ?? "",
				title: dep.title,
				status: dep.done ? "done" : "pending",
			})),
			dependents: dependents.map((dep) => ({
				id: dep.id ?? "",
				title: dep.title,
				status: dep.done ? "done" : "pending",
			})),
			isReady: canExecute.canExecute,
			blockedBy: taskInfo?.blockedBy ?? [],
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	const statusLabel = task.done ? "\x1b[32mdone\x1b[0m" : "\x1b[33mpending\x1b[0m";
	const idLabel = task.id ? ` (id: ${task.id})` : "";
	const priorityLabel = task.priority !== undefined ? ` | Priority: ${task.priority}` : "";

	console.log(`Task [${taskIndex + 1}]: ${task.title}${idLabel}`);
	console.log(`Status: ${statusLabel}${priorityLabel}`);

	if (dependencies.length > 0) {
		console.log("\nDependencies:");

		for (const dep of dependencies) {
			const depStatusIcon = dep.done ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";

			console.log(`  ${depStatusIcon} ${dep.title}${dep.id ? ` (${dep.id})` : ""}`);
		}
	} else {
		console.log("\nDependencies: none");
	}

	if (dependents.length > 0) {
		console.log("\nDependent tasks (blocked by this task):");

		for (const dep of dependents) {
			const depStatusIcon = dep.done ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";

			console.log(`  ${depStatusIcon} ${dep.title}${dep.id ? ` (${dep.id})` : ""}`);
		}
	} else {
		console.log("\nDependent tasks: none");
	}

	if (!task.done) {
		console.log();

		if (canExecute.canExecute) {
			console.log("\x1b[32m✓\x1b[0m Task is ready for execution");
		} else {
			console.log(`\x1b[33m○\x1b[0m ${canExecute.reason}`);
		}
	}
}

export function handleDependencySet(
	identifier: string,
	dependencies: string[],
	jsonOutput: boolean,
): void {
	if (!identifier.trim()) {
		handleMissingIdentifier(jsonOutput);

		return;
	}

	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const taskIndex = resolveTaskIndex(prd, identifier);

	if (taskIndex === null) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const task = prd.tasks.at(taskIndex);

	if (!task) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	if (!task.id && dependencies.length > 0) {
		const error = createError(
			ErrorCode.INVALID_INPUT,
			`Task "${task.title}" needs an ID to have dependencies`,
		);

		if (jsonOutput) {
			const output: DependencyErrorJsonOutput = {
				error: error.message,
				code: error.code,
				suggestion: "First set the task ID using: ralph task edit <task> --id <id>",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error(formatError(error));
			console.log('\nFirst set a task ID using: ralph task edit <task> --title "..." or add an id');
		}

		process.exit(1);
	}

	for (const depId of dependencies) {
		const depExists = prd.tasks.some((t) => t.id === depId);

		if (!depExists) {
			const error = createError(ErrorCode.INVALID_INPUT, `Dependency "${depId}" does not exist`);

			if (jsonOutput) {
				const output: DependencyErrorJsonOutput = {
					error: error.message,
					code: error.code,
					suggestion: "Use an existing task ID as a dependency",
				};

				console.log(JSON.stringify(output, null, 2));
			} else {
				console.error(formatError(error));
			}

			process.exit(1);
		}
	}

	const updatedTask: PrdTask = {
		...task,
		dependsOn: dependencies.length > 0 ? dependencies : undefined,
	};

	const updatedTasks = prd.tasks.map((currentTask, index) =>
		index === taskIndex ? updatedTask : currentTask,
	);

	savePrd({ ...prd, tasks: updatedTasks });

	if (jsonOutput) {
		const output: DependencySetJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
			},
			dependencies,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (dependencies.length === 0) {
		console.log(
			`\x1b[32m✓\x1b[0m Cleared dependencies for task [${taskIndex + 1}] "${task.title}"`,
		);
	} else {
		console.log(
			`\x1b[32m✓\x1b[0m Set dependencies for task [${taskIndex + 1}] "${task.title}": ${dependencies.join(", ")}`,
		);
	}
}

export function handleDependencyAdd(
	identifier: string,
	dependencyId: string,
	jsonOutput: boolean,
): void {
	if (!identifier.trim()) {
		handleMissingIdentifier(jsonOutput);

		return;
	}

	if (!dependencyId.trim()) {
		const error = createError(ErrorCode.INVALID_INPUT, "Dependency ID is required");

		if (jsonOutput) {
			const output: DependencyErrorJsonOutput = {
				error: error.message,
				code: error.code,
				suggestion: "Provide a task ID to add as a dependency",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m Dependency ID is required");
			console.log("\nUsage: ralph dependency add <task> <dependency-id>");
		}

		process.exit(1);
	}

	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const taskIndex = resolveTaskIndex(prd, identifier);

	if (taskIndex === null) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const task = prd.tasks.at(taskIndex);

	if (!task) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	if (!task.id) {
		const error = createError(
			ErrorCode.INVALID_INPUT,
			`Task "${task.title}" needs an ID to have dependencies`,
		);

		if (jsonOutput) {
			const output: DependencyErrorJsonOutput = {
				error: error.message,
				code: error.code,
				suggestion: "First set the task ID",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error(formatError(error));
		}

		process.exit(1);
	}

	const depExists = prd.tasks.some((t) => t.id === dependencyId);

	if (!depExists) {
		const error = createError(
			ErrorCode.INVALID_INPUT,
			`Task with ID "${dependencyId}" does not exist`,
		);

		if (jsonOutput) {
			const output: DependencyErrorJsonOutput = {
				error: error.message,
				code: error.code,
				suggestion: "Use an existing task ID as a dependency",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error(formatError(error));
		}

		process.exit(1);
	}

	const existingDeps = task.dependsOn ?? [];

	if (existingDeps.includes(dependencyId)) {
		if (jsonOutput) {
			const output: DependencySetJsonOutput = {
				success: true,
				task: {
					index: taskIndex + 1,
					title: task.title,
				},
				dependencies: existingDeps,
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log(`Task [${taskIndex + 1}] "${task.title}" already depends on "${dependencyId}"`);
		}

		return;
	}

	const newDeps = [...existingDeps, dependencyId];

	const updatedTask: PrdTask = {
		...task,
		dependsOn: newDeps,
	};

	const updatedTasks = prd.tasks.map((currentTask, index) =>
		index === taskIndex ? updatedTask : currentTask,
	);

	savePrd({ ...prd, tasks: updatedTasks });

	if (jsonOutput) {
		const output: DependencySetJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
			},
			dependencies: newDeps,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(
		`\x1b[32m✓\x1b[0m Added dependency "${dependencyId}" to task [${taskIndex + 1}] "${task.title}"`,
	);
}

export function handleDependencyRemove(
	identifier: string,
	dependencyId: string,
	jsonOutput: boolean,
): void {
	if (!identifier.trim()) {
		handleMissingIdentifier(jsonOutput);

		return;
	}

	if (!dependencyId.trim()) {
		const error = createError(ErrorCode.INVALID_INPUT, "Dependency ID is required");

		if (jsonOutput) {
			const output: DependencyErrorJsonOutput = {
				error: error.message,
				code: error.code,
				suggestion: "Provide a dependency ID to remove",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m Dependency ID is required");
			console.log("\nUsage: ralph dependency remove <task> <dependency-id>");
		}

		process.exit(1);
	}

	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const taskIndex = resolveTaskIndex(prd, identifier);

	if (taskIndex === null) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const task = prd.tasks.at(taskIndex);

	if (!task) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	const existingDeps = task.dependsOn ?? [];

	if (!existingDeps.includes(dependencyId)) {
		if (jsonOutput) {
			const output: DependencyRemoveJsonOutput = {
				success: true,
				task: {
					index: taskIndex + 1,
					title: task.title,
				},
				removedDependency: dependencyId,
				remainingDependencies: existingDeps,
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log(`Task [${taskIndex + 1}] "${task.title}" does not depend on "${dependencyId}"`);
		}

		return;
	}

	const newDeps = existingDeps.filter((dep) => dep !== dependencyId);

	const updatedTask: PrdTask = {
		...task,
		dependsOn: newDeps.length > 0 ? newDeps : undefined,
	};

	const updatedTasks = prd.tasks.map((currentTask, index) =>
		index === taskIndex ? updatedTask : currentTask,
	);

	savePrd({ ...prd, tasks: updatedTasks });

	if (jsonOutput) {
		const output: DependencyRemoveJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
			},
			removedDependency: dependencyId,
			remainingDependencies: newDeps,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(
		`\x1b[32m✓\x1b[0m Removed dependency "${dependencyId}" from task [${taskIndex + 1}] "${task.title}"`,
	);
}
