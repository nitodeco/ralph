import { createError, ErrorCode, formatError } from "@/lib/errors.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import type { Prd } from "@/types.ts";

interface TaskInfo {
	index: number;
	title: string;
	status: "done" | "pending";
}

interface TaskListJsonOutput {
	tasks: TaskInfo[];
	summary: {
		total: number;
		completed: number;
		pending: number;
	};
}

interface TaskDoneJsonOutput {
	success: boolean;
	task: TaskInfo;
	previousStatus: "done" | "pending";
	noChange?: boolean;
}

interface CurrentTaskJsonOutput {
	task: TaskInfo | null;
	allTasksComplete: boolean;
}

interface TaskErrorJsonOutput {
	error: string;
	code: string;
	suggestion?: string;
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
	const matchingTaskIndex = prd.tasks.findIndex(
		(task) => task.title.toLowerCase() === normalizedIdentifier,
	);

	if (matchingTaskIndex !== -1) {
		return matchingTaskIndex;
	}

	return null;
}

function formatTaskStatus(task: { title: string; done: boolean }, index: number): string {
	const statusIcon = task.done ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";
	const dimStyle = task.done ? "\x1b[2m" : "";
	const resetStyle = "\x1b[0m";
	const statusLabel = task.done ? "done" : "pending";

	return `${dimStyle}${statusIcon} [${index + 1}] ${task.title} (${statusLabel})${resetStyle}`;
}

function handlePrdNotFound(jsonOutput: boolean): void {
	const error = createError(ErrorCode.PRD_NOT_FOUND, "No PRD found");

	if (jsonOutput) {
		const output: TaskErrorJsonOutput = {
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
		const output: TaskErrorJsonOutput = {
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
		const output: TaskErrorJsonOutput = {
			error: error.message,
			code: error.code,
			suggestion: "Provide a task number (1-based) or task title",
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.error("\x1b[31mError:\x1b[0m Task identifier is required");
		console.log("\nUsage: ralph task done <task-number|task-title>");
	}

	process.exit(1);
}

export function printTaskList(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const completedCount = prd.tasks.filter((task) => task.done).length;
	const pendingCount = prd.tasks.length - completedCount;

	if (jsonOutput) {
		const output: TaskListJsonOutput = {
			tasks: prd.tasks.map((task, taskIndex) => ({
				index: taskIndex + 1,
				title: task.title,
				status: task.done ? "done" : "pending",
			})),
			summary: {
				total: prd.tasks.length,
				completed: completedCount,
				pending: pendingCount,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("Tasks:\n");

	if (prd.tasks.length === 0) {
		console.log("No tasks defined.");
		console.log("\nRun 'ralph init' to add tasks.");

		return;
	}

	for (const [taskIndex, task] of prd.tasks.entries()) {
		console.log(formatTaskStatus(task, taskIndex));
	}

	console.log(`\nTotal: ${prd.tasks.length} | Done: ${completedCount} | Pending: ${pendingCount}`);
}

export function printCurrentTask(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const nextPendingIndex = prd.tasks.findIndex((task) => !task.done);
	const isAllComplete = nextPendingIndex === -1;

	if (jsonOutput) {
		const output: CurrentTaskJsonOutput = {
			task: isAllComplete
				? null
				: {
						index: nextPendingIndex + 1,
						title: prd.tasks.at(nextPendingIndex)?.title ?? "",
						status: "pending",
					},
			allTasksComplete: isAllComplete,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (isAllComplete) {
		console.log("\x1b[32m✓\x1b[0m All tasks complete!");

		return;
	}

	const currentTask = prd.tasks.at(nextPendingIndex);

	if (currentTask) {
		console.log(`Current task: [${nextPendingIndex + 1}] ${currentTask.title}`);
	}
}

export function handleTaskDone(identifier: string, jsonOutput: boolean): void {
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

	const previousStatus = task.done ? "done" : "pending";
	const isNoChange = task.done;

	if (!task.done) {
		const updatedTasks = prd.tasks.map((currentTask, index) =>
			index === taskIndex ? { ...currentTask, done: true } : currentTask,
		);

		savePrd({ ...prd, tasks: updatedTasks });
	}

	if (jsonOutput) {
		const output: TaskDoneJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
				status: "done",
			},
			previousStatus,
			...(isNoChange && { noChange: true }),
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (isNoChange) {
		console.log(`Task [${taskIndex + 1}] "${task.title}" was already done`);
	} else {
		console.log(`\x1b[32m✓\x1b[0m Marked task [${taskIndex + 1}] "${task.title}" as done`);
	}
}

export function handleTaskUndone(identifier: string, jsonOutput: boolean): void {
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

	const previousStatus = task.done ? "done" : "pending";
	const isNoChange = !task.done;

	if (task.done) {
		const updatedTasks = prd.tasks.map((currentTask, index) =>
			index === taskIndex ? { ...currentTask, done: false } : currentTask,
		);

		savePrd({ ...prd, tasks: updatedTasks });
	}

	if (jsonOutput) {
		const output: TaskDoneJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
				status: "pending",
			},
			previousStatus,
			...(isNoChange && { noChange: true }),
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (isNoChange) {
		console.log(`Task [${taskIndex + 1}] "${task.title}" was already pending`);
	} else {
		console.log(`\x1b[33m○\x1b[0m Marked task [${taskIndex + 1}] "${task.title}" as pending`);
	}
}
