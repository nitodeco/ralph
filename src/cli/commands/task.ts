import { createError, ErrorCode, formatError } from "@/lib/errors.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import type { Prd, PrdTask, TaskAddOptions, TaskEditOptions } from "@/types.ts";

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

interface TaskStdinInput {
	title?: string;
	description?: string;
	steps?: string[];
}

async function readStdinAsync(): Promise<string> {
	const chunks: Uint8Array[] = [];

	try {
		const reader = Bun.stdin.stream().getReader();

		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				break;
			}

			chunks.push(value);
		}

		const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
		const stdinBuffer = new Uint8Array(totalLength);
		let offset = 0;

		for (const chunk of chunks) {
			stdinBuffer.set(chunk, offset);
			offset += chunk.length;
		}

		return new TextDecoder().decode(stdinBuffer).trim();
	} catch {
		return "";
	}
}

async function parseStdinJson(): Promise<TaskStdinInput | null> {
	const stdinContent = await readStdinAsync();

	if (!stdinContent) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(stdinContent);

		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}

		const maybeInput = parsed as Record<string, unknown>;

		return {
			title: typeof maybeInput.title === "string" ? maybeInput.title : undefined,
			description: typeof maybeInput.description === "string" ? maybeInput.description : undefined,
			steps: Array.isArray(maybeInput.steps)
				? maybeInput.steps.filter((step): step is string => typeof step === "string")
				: undefined,
		};
	} catch {
		return null;
	}
}

interface TaskAddJsonOutput {
	success: boolean;
	task: TaskInfo;
	index: number;
}

export async function handleTaskAdd(options: TaskAddOptions, jsonOutput: boolean): Promise<void> {
	let title: string | undefined = options.title;
	let description: string | undefined = options.description;
	let steps: string[] | undefined = options.steps;

	if (options.stdin) {
		const stdinInput = await parseStdinJson();

		if (!stdinInput) {
			if (jsonOutput) {
				const output: TaskErrorJsonOutput = {
					error: "Failed to parse JSON from stdin",
					code: "INVALID_INPUT",
					suggestion:
						'Expected JSON format: {"title": "...", "description": "...", "steps": ["..."]}',
				};

				console.log(JSON.stringify(output, null, 2));
			} else {
				console.error("\x1b[31mError:\x1b[0m Failed to parse JSON from stdin");
				console.log('\nExpected format: {"title": "...", "description": "...", "steps": ["..."]}');
			}

			process.exit(1);
		}

		title = stdinInput.title ?? title;
		description = stdinInput.description ?? description;
		steps = stdinInput.steps ?? steps;
	}

	if (!title) {
		if (jsonOutput) {
			const output: TaskErrorJsonOutput = {
				error: "Task title is required",
				code: "INVALID_INPUT",
				suggestion: "Provide --title or use --stdin with JSON containing title",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m Task title is required");
		}

		process.exit(1);
	}

	if (!description) {
		if (jsonOutput) {
			const output: TaskErrorJsonOutput = {
				error: "Task description is required",
				code: "INVALID_INPUT",
				suggestion: "Provide --description or use --stdin with JSON containing description",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m Task description is required");
		}

		process.exit(1);
	}

	if (!steps || steps.length === 0) {
		if (jsonOutput) {
			const output: TaskErrorJsonOutput = {
				error: "At least one step is required",
				code: "INVALID_INPUT",
				suggestion: "Provide --steps or use --stdin with JSON containing steps array",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m At least one step is required");
		}

		process.exit(1);
	}

	const prd = loadPrd();

	if (!prd) {
		handlePrdNotFound(jsonOutput);

		return;
	}

	const newTask: PrdTask = {
		title,
		description,
		steps,
		done: false,
	};

	const updatedPrd: Prd = {
		...prd,
		tasks: [...prd.tasks, newTask],
	};

	savePrd(updatedPrd);

	const newIndex = updatedPrd.tasks.length;

	if (jsonOutput) {
		const output: TaskAddJsonOutput = {
			success: true,
			task: {
				index: newIndex,
				title,
				status: "pending",
			},
			index: newIndex,
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.log(`\x1b[32m✓\x1b[0m Added task [${newIndex}] "${title}"`);
	}
}

interface TaskEditJsonOutput {
	success: boolean;
	task: TaskInfo;
	changes: {
		title?: boolean;
		description?: boolean;
		steps?: boolean;
	};
}

export async function handleTaskEdit(
	identifier: string,
	options: TaskEditOptions,
	jsonOutput: boolean,
): Promise<void> {
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

	const existingTask = prd.tasks.at(taskIndex);

	if (!existingTask) {
		handleTaskNotFound(identifier, jsonOutput);

		return;
	}

	let newTitle: string | undefined = options.title;
	let newDescription: string | undefined = options.description;
	let newSteps: string[] | undefined = options.steps;

	if (options.stdin) {
		const stdinInput = await parseStdinJson();

		if (!stdinInput) {
			if (jsonOutput) {
				const output: TaskErrorJsonOutput = {
					error: "Failed to parse JSON from stdin",
					code: "INVALID_INPUT",
					suggestion:
						'Expected JSON format: {"title": "...", "description": "...", "steps": ["..."]}',
				};

				console.log(JSON.stringify(output, null, 2));
			} else {
				console.error("\x1b[31mError:\x1b[0m Failed to parse JSON from stdin");
				console.log('\nExpected format: {"title": "...", "description": "...", "steps": ["..."]}');
			}

			process.exit(1);
		}

		newTitle = stdinInput.title ?? newTitle;
		newDescription = stdinInput.description ?? newDescription;
		newSteps = stdinInput.steps ?? newSteps;
	}

	const hasChanges =
		newTitle !== undefined || newDescription !== undefined || newSteps !== undefined;

	if (!hasChanges) {
		if (jsonOutput) {
			const output: TaskErrorJsonOutput = {
				error: "No changes provided",
				code: "INVALID_INPUT",
				suggestion: "Provide --title, --description, --steps, or use --stdin with JSON",
			};

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m No changes provided");
		}

		process.exit(1);
	}

	const updatedTask: PrdTask = {
		title: newTitle ?? existingTask.title,
		description: newDescription ?? existingTask.description,
		steps: newSteps ?? existingTask.steps,
		done: existingTask.done,
	};

	const updatedTasks = prd.tasks.map((currentTask, index) =>
		index === taskIndex ? updatedTask : currentTask,
	);

	savePrd({ ...prd, tasks: updatedTasks });

	if (jsonOutput) {
		const output: TaskEditJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: updatedTask.title,
				status: updatedTask.done ? "done" : "pending",
			},
			changes: {
				title: newTitle !== undefined,
				description: newDescription !== undefined,
				steps: newSteps !== undefined,
			},
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.log(`\x1b[32m✓\x1b[0m Updated task [${taskIndex + 1}] "${updatedTask.title}"`);
	}
}

interface TaskRemoveJsonOutput {
	success: boolean;
	task: TaskInfo;
}

export function handleTaskRemove(identifier: string, jsonOutput: boolean): void {
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

	const updatedTasks = prd.tasks.filter((_, index) => index !== taskIndex);

	savePrd({ ...prd, tasks: updatedTasks });

	if (jsonOutput) {
		const output: TaskRemoveJsonOutput = {
			success: true,
			task: {
				index: taskIndex + 1,
				title: task.title,
				status: task.done ? "done" : "pending",
			},
		};

		console.log(JSON.stringify(output, null, 2));
	} else {
		console.log(`\x1b[32m✓\x1b[0m Removed task [${taskIndex + 1}] "${task.title}"`);
	}
}

interface TaskShowJsonOutput {
	task: {
		index: number;
		title: string;
		description: string;
		status: "done" | "pending";
		steps: string[];
	};
}

export function printTaskShow(identifier: string, jsonOutput: boolean): void {
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

	if (jsonOutput) {
		const output: TaskShowJsonOutput = {
			task: {
				index: taskIndex + 1,
				title: task.title,
				description: task.description,
				status: task.done ? "done" : "pending",
				steps: task.steps,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	const statusLabel = task.done ? "\x1b[32mdone\x1b[0m" : "\x1b[33mpending\x1b[0m";

	console.log(`Task [${taskIndex + 1}]: ${task.title}`);
	console.log(`Status: ${statusLabel}`);
	console.log(`Description: ${task.description}`);
	console.log("Steps:");

	for (const [stepIndex, step] of task.steps.entries()) {
		console.log(`  ${stepIndex + 1}. ${step}`);
	}
}
