import { existsSync, readFileSync } from "node:fs";
import { createError, ErrorCode, formatError } from "../../errors.ts";
import { writeFileIdempotent } from "../../idempotency.ts";
import { getInstructionsFilePath, getPrdJsonPath } from "../../paths.ts";
import type {
	CanWorkResult,
	LoadPrdResult,
	Prd,
	PrdService,
	PrdTask,
	TaskWithIndex,
} from "./types.ts";
import { isPrd } from "./validation.ts";

function findPrdFile(): string | null {
	const prdJsonPath = getPrdJsonPath();

	if (existsSync(prdJsonPath)) {
		return prdJsonPath;
	}

	return null;
}

function loadPrdFromDisk(): LoadPrdResult {
	const prdPath = findPrdFile();

	if (!prdPath) {
		return { prd: null };
	}

	try {
		const content = readFileSync(prdPath, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isPrd(parsed)) {
			return {
				prd: null,
				validationError: "PRD is missing required fields or has invalid structure",
			};
		}

		return { prd: parsed };
	} catch (parseError) {
		const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";

		return {
			prd: null,
			validationError: `Failed to parse PRD file: ${errorMessage}`,
		};
	}
}

export function createPrdService(): PrdService {
	let cachedPrd: Prd | null = null;
	let cachedLoadResult: LoadPrdResult | null = null;

	function load(verbose = false): Prd | null {
		const result = loadWithValidation();

		if (result.validationError) {
			const error = createError(ErrorCode.PRD_INVALID_FORMAT, result.validationError, {
				path: findPrdFile(),
			});

			console.error(formatError(error, verbose));
		}

		cachedPrd = result.prd;

		return result.prd;
	}

	function loadWithValidation(): LoadPrdResult {
		if (cachedLoadResult !== null) {
			return cachedLoadResult;
		}

		cachedLoadResult = loadPrdFromDisk();
		cachedPrd = cachedLoadResult.prd;

		return cachedLoadResult;
	}

	return {
		get(verbose = false): Prd | null {
			if (cachedPrd !== null) {
				return cachedPrd;
			}

			return load(verbose);
		},

		load,

		loadWithValidation,

		reload(verbose = false): Prd | null {
			this.invalidate();

			return load(verbose);
		},

		reloadWithValidation(): LoadPrdResult {
			this.invalidate();

			return loadWithValidation();
		},

		save(prd: Prd): void {
			const prdPath = findPrdFile();
			const targetPath = prdPath ?? getPrdJsonPath();

			writeFileIdempotent(targetPath, JSON.stringify(prd, null, "\t"));

			this.invalidate();
		},

		invalidate(): void {
			cachedPrd = null;
			cachedLoadResult = null;
		},

		findFile(): string | null {
			return findPrdFile();
		},

		isComplete(prd: Prd): boolean {
			return prd.tasks.every((task) => task.done);
		},

		getNextTask(prd: Prd): string | null {
			const nextTask = prd.tasks.find((task) => !task.done);

			return nextTask ? nextTask.title : null;
		},

		getNextTaskWithIndex(prd: Prd): TaskWithIndex | null {
			for (let taskIndex = 0; taskIndex < prd.tasks.length; taskIndex++) {
				const task = prd.tasks.at(taskIndex);

				if (task && !task.done) {
					return { title: task.title, index: taskIndex };
				}
			}

			return null;
		},

		getTaskByTitle(prd: Prd, title: string): PrdTask | null {
			const normalizedTitle = title.toLowerCase();

			return prd.tasks.find((task) => task.title.toLowerCase() === normalizedTitle) ?? null;
		},

		getTaskByIndex(prd: Prd, index: number): PrdTask | null {
			if (index < 0 || index >= prd.tasks.length) {
				return null;
			}

			return prd.tasks.at(index) ?? null;
		},

		getCurrentTaskIndex(prd: Prd): number {
			return prd.tasks.findIndex((task) => !task.done);
		},

		canWorkOnTask(task: PrdTask): CanWorkResult {
			if (task.done) {
				return { canWork: false, reason: "Task is already completed" };
			}

			return { canWork: true };
		},

		createEmpty(projectName: string): Prd {
			return {
				project: projectName,
				tasks: [],
			};
		},

		loadInstructions(): string | null {
			const instructionsFilePath = getInstructionsFilePath();

			if (!existsSync(instructionsFilePath)) {
				return null;
			}

			return readFileSync(instructionsFilePath, "utf-8");
		},

		toggleTaskDone(prd: Prd, taskIndex: number): Prd {
			const task = prd.tasks.at(taskIndex);

			if (!task) {
				return prd;
			}

			const updatedTasks = prd.tasks.map((currentTask, index) =>
				index === taskIndex ? { ...currentTask, done: !currentTask.done } : currentTask,
			);

			return { ...prd, tasks: updatedTasks };
		},

		deleteTask(prd: Prd, taskIndex: number): Prd {
			if (taskIndex < 0 || taskIndex >= prd.tasks.length) {
				return prd;
			}

			const updatedTasks = prd.tasks.filter((_, index) => index !== taskIndex);

			return { ...prd, tasks: updatedTasks };
		},

		reorderTask(prd: Prd, fromIndex: number, toIndex: number): Prd {
			const tasksLength = prd.tasks.length;

			if (fromIndex < 0 || fromIndex >= tasksLength || toIndex < 0 || toIndex >= tasksLength) {
				return prd;
			}

			if (fromIndex === toIndex) {
				return prd;
			}

			const taskToMove = prd.tasks.at(fromIndex);

			if (!taskToMove) {
				return prd;
			}

			const tasksWithoutMoved = prd.tasks.filter((_, index) => index !== fromIndex);
			const updatedTasks = [
				...tasksWithoutMoved.slice(0, toIndex),
				taskToMove,
				...tasksWithoutMoved.slice(toIndex),
			];

			return { ...prd, tasks: updatedTasks };
		},

		updateTask(prd: Prd, taskIndex: number, updatedTask: PrdTask): Prd {
			if (taskIndex < 0 || taskIndex >= prd.tasks.length) {
				return prd;
			}

			const updatedTasks = prd.tasks.map((currentTask, index) =>
				index === taskIndex ? updatedTask : currentTask,
			);

			return { ...prd, tasks: updatedTasks };
		},
	};
}
