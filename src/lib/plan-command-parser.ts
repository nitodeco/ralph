import type { PlanDiffTask, Prd, PrdTask } from "@/types.ts";

export interface ParsedTaskCommand {
	type: "add" | "edit" | "remove";
	taskIndex?: number;
	task?: Partial<PrdTask>;
}

interface ParsedTaskJson {
	title?: string;
	description?: string;
	steps?: string[];
}

function extractHeredocJson(output: string, commandEndIndex: number): ParsedTaskJson | null {
	const afterCommand = output.slice(commandEndIndex);
	const eofStart = afterCommand.indexOf("<<EOF");

	if (eofStart === -1) {
		return null;
	}

	const jsonStart = afterCommand.indexOf("\n", eofStart) + 1;
	const eofEnd = afterCommand.indexOf("EOF", jsonStart);

	if (eofEnd === -1) {
		return null;
	}

	const jsonContent = afterCommand.slice(jsonStart, eofEnd).trim();

	try {
		const parsed: unknown = JSON.parse(jsonContent);

		if (typeof parsed !== "object" || parsed === null) {
			return null;
		}

		const maybeTask = parsed as Record<string, unknown>;

		return {
			title: typeof maybeTask.title === "string" ? maybeTask.title : undefined,
			description: typeof maybeTask.description === "string" ? maybeTask.description : undefined,
			steps: Array.isArray(maybeTask.steps)
				? maybeTask.steps.filter((step): step is string => typeof step === "string")
				: undefined,
		};
	} catch {
		return null;
	}
}

function parseAddCommand(output: string, commandMatch: RegExpMatchArray): ParsedTaskCommand | null {
	const commandEnd = (commandMatch.index ?? 0) + commandMatch[0].length;
	const taskJson = extractHeredocJson(output, commandEnd);

	if (!taskJson || !taskJson.title || !taskJson.description || !taskJson.steps) {
		return null;
	}

	return {
		type: "add",
		task: {
			title: taskJson.title,
			description: taskJson.description,
			steps: taskJson.steps,
			done: false,
		},
	};
}

function parseEditCommand(
	output: string,
	commandMatch: RegExpMatchArray,
): ParsedTaskCommand | null {
	const taskIndexStr = commandMatch.at(1);

	if (!taskIndexStr) {
		return null;
	}

	const taskIndex = Number.parseInt(taskIndexStr, 10);

	if (Number.isNaN(taskIndex) || taskIndex < 1) {
		return null;
	}

	const commandEnd = (commandMatch.index ?? 0) + commandMatch[0].length;
	const taskJson = extractHeredocJson(output, commandEnd);

	if (!taskJson) {
		return null;
	}

	return {
		type: "edit",
		taskIndex: taskIndex - 1,
		task: {
			title: taskJson.title,
			description: taskJson.description,
			steps: taskJson.steps,
		},
	};
}

function parseRemoveCommand(commandMatch: RegExpMatchArray): ParsedTaskCommand | null {
	const taskIndexStr = commandMatch.at(1);

	if (!taskIndexStr) {
		return null;
	}

	const taskIndex = Number.parseInt(taskIndexStr, 10);

	if (Number.isNaN(taskIndex) || taskIndex < 1) {
		return null;
	}

	return {
		type: "remove",
		taskIndex: taskIndex - 1,
	};
}

export function parseTaskCommandsFromOutput(output: string): ParsedTaskCommand[] {
	const commands: ParsedTaskCommand[] = [];

	const addPattern = /ralph task add --stdin/g;
	const editPattern = /ralph task edit (\d+) --stdin/g;
	const removePattern = /ralph task remove (\d+)/g;

	const addMatches = output.matchAll(addPattern);

	for (const addMatch of addMatches) {
		const command = parseAddCommand(output, addMatch);

		if (command) {
			commands.push(command);
		}
	}

	const editMatches = output.matchAll(editPattern);

	for (const editMatch of editMatches) {
		const command = parseEditCommand(output, editMatch);

		if (command) {
			commands.push(command);
		}
	}

	const removeMatches = output.matchAll(removePattern);

	for (const removeMatch of removeMatches) {
		const command = parseRemoveCommand(removeMatch);

		if (command) {
			commands.push(command);
		}
	}

	return commands;
}

export function commandsToDiffTasks(
	commands: ParsedTaskCommand[],
	existingPrd: Prd | null,
): PlanDiffTask[] {
	const diffTasks: PlanDiffTask[] = [];
	const existingTasks = existingPrd?.tasks ?? [];
	const modifiedIndices = new Set<number>();
	const removedIndices = new Set<number>();

	for (const command of commands) {
		if (command.type === "edit" && command.taskIndex !== undefined && command.task) {
			const existingTask = existingTasks.at(command.taskIndex);

			if (existingTask) {
				modifiedIndices.add(command.taskIndex);

				const updatedTask: PrdTask = {
					title: command.task.title ?? existingTask.title,
					description: command.task.description ?? existingTask.description,
					steps: command.task.steps ?? existingTask.steps,
					done: existingTask.done,
				};

				diffTasks.push({
					task: updatedTask,
					status: "modified",
					originalTask: existingTask,
				});
			}
		} else if (command.type === "remove" && command.taskIndex !== undefined) {
			const existingTask = existingTasks.at(command.taskIndex);

			if (existingTask) {
				removedIndices.add(command.taskIndex);

				diffTasks.push({
					task: existingTask,
					status: "removed",
					originalTask: existingTask,
				});
			}
		}
	}

	for (const command of commands) {
		if (command.type === "add" && command.task) {
			const newTask: PrdTask = {
				title: command.task.title ?? "",
				description: command.task.description ?? "",
				steps: command.task.steps ?? [],
				done: false,
			};

			diffTasks.push({
				task: newTask,
				status: "new",
			});
		}
	}

	for (let taskIndex = 0; taskIndex < existingTasks.length; taskIndex++) {
		if (!modifiedIndices.has(taskIndex) && !removedIndices.has(taskIndex)) {
			const existingTask = existingTasks.at(taskIndex);

			if (existingTask) {
				diffTasks.push({
					task: existingTask,
					status: "unchanged",
				});
			}
		}
	}

	return diffTasks;
}

export function applyApprovedCommands(
	existingPrd: Prd | null,
	diffTasks: PlanDiffTask[],
	acceptedIndices: Set<number>,
	editedTasks?: Map<number, PrdTask>,
): Prd {
	const projectName = existingPrd?.project ?? "Untitled Project";
	const tasks: PrdTask[] = [];

	for (let diffIndex = 0; diffIndex < diffTasks.length; diffIndex++) {
		const diffTask = diffTasks.at(diffIndex);

		if (!diffTask) {
			continue;
		}

		const isAccepted = acceptedIndices.has(diffIndex);
		const maybeEditedTask = editedTasks?.get(diffIndex);

		if (diffTask.status === "removed") {
			if (!isAccepted && diffTask.originalTask) {
				tasks.push(maybeEditedTask ?? diffTask.originalTask);
			}
		} else if (diffTask.status === "modified") {
			if (isAccepted) {
				tasks.push(maybeEditedTask ?? diffTask.task);
			} else if (diffTask.originalTask) {
				tasks.push(maybeEditedTask ?? diffTask.originalTask);
			}
		} else if (diffTask.status === "new") {
			if (isAccepted) {
				tasks.push(maybeEditedTask ?? diffTask.task);
			}
		} else if (diffTask.status === "unchanged") {
			tasks.push(maybeEditedTask ?? diffTask.task);
		}
	}

	return {
		project: projectName,
		tasks,
	};
}
