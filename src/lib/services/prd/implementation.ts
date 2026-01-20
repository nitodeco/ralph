import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createError, ErrorCode, formatError } from "../../errors.ts";
import { INSTRUCTIONS_FILE_PATH, PRD_JSON_PATH } from "../../paths.ts";
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
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
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
			const targetPath = prdPath ?? PRD_JSON_PATH;

			writeFileSync(targetPath, JSON.stringify(prd, null, "\t"));

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
			if (!existsSync(INSTRUCTIONS_FILE_PATH)) {
				return null;
			}

			return readFileSync(INSTRUCTIONS_FILE_PATH, "utf-8");
		},
	};
}
