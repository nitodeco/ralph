import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { LoadPrdResult, Prd, PrdTask } from "@/types.ts";
import { createError, ErrorCode, formatError } from "./errors.ts";
import { INSTRUCTIONS_FILE_PATH, PRD_JSON_PATH, PRD_YAML_PATH } from "./paths.ts";

export { INSTRUCTIONS_FILE_PATH } from "./paths.ts";

export function findPrdFile(): string | null {
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
	}
	if (existsSync(PRD_YAML_PATH)) {
		return PRD_YAML_PATH;
	}
	return null;
}

export function loadPrd(verbose = false): Prd | null {
	const result = loadPrdWithValidation();
	if (result.validationError) {
		const error = createError(ErrorCode.PRD_INVALID_FORMAT, result.validationError, {
			path: findPrdFile(),
		});
		console.error(formatError(error, verbose));
	}
	return result.prd;
}

export function loadPrdWithValidation(): LoadPrdResult {
	const prdPath = findPrdFile();
	if (!prdPath) {
		return { prd: null };
	}

	try {
		const content = readFileSync(prdPath, "utf-8");

		let prd: Prd;
		if (prdPath.endsWith(".yaml") || prdPath.endsWith(".yml")) {
			prd = parseYaml(content) as Prd;
		} else {
			prd = JSON.parse(content) as Prd;
		}

		if (!prd.project) {
			return {
				prd: null,
				validationError: "PRD is missing required 'project' field",
			};
		}

		if (!Array.isArray(prd.tasks)) {
			return {
				prd: null,
				validationError: "PRD is missing required 'tasks' array",
			};
		}

		return { prd };
	} catch (parseError) {
		const errorMessage = parseError instanceof Error ? parseError.message : "Unknown parsing error";
		return {
			prd: null,
			validationError: `Failed to parse PRD file: ${errorMessage}`,
		};
	}
}

export function savePrd(prd: Prd, format: "json" | "yaml" = "json"): void {
	const prdPath = findPrdFile();
	const targetPath = prdPath ?? (format === "yaml" ? PRD_YAML_PATH : PRD_JSON_PATH);

	if (targetPath.endsWith(".yaml") || targetPath.endsWith(".yml")) {
		writeFileSync(targetPath, stringifyYaml(prd));
	} else {
		writeFileSync(targetPath, JSON.stringify(prd, null, 2));
	}
}

export function isPrdComplete(prd: Prd): boolean {
	return prd.tasks.every((task) => task.done);
}

export function getNextTask(prd: Prd): string | null {
	const nextTask = prd.tasks.find((task) => !task.done);
	return nextTask ? nextTask.title : null;
}

export interface TaskWithIndex {
	title: string;
	index: number;
}

export function getNextTaskWithIndex(prd: Prd): TaskWithIndex | null {
	for (let taskIndex = 0; taskIndex < prd.tasks.length; taskIndex++) {
		const task = prd.tasks[taskIndex];
		if (task && !task.done) {
			return { title: task.title, index: taskIndex };
		}
	}
	return null;
}

export function getTaskByTitle(prd: Prd, title: string): PrdTask | null {
	const normalizedTitle = title.toLowerCase();
	return prd.tasks.find((task) => task.title.toLowerCase() === normalizedTitle) ?? null;
}

export function getTaskByIndex(prd: Prd, index: number): PrdTask | null {
	if (index < 0 || index >= prd.tasks.length) {
		return null;
	}
	return prd.tasks[index] ?? null;
}

export function canWorkOnTask(task: PrdTask): { canWork: boolean; reason?: string } {
	if (task.done) {
		return { canWork: false, reason: "Task is already completed" };
	}

	return { canWork: true };
}

export function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

export function createEmptyPrd(projectName: string): Prd {
	return {
		project: projectName,
		tasks: [],
	};
}

export function loadInstructions(): string | null {
	if (!existsSync(INSTRUCTIONS_FILE_PATH)) {
		return null;
	}

	return readFileSync(INSTRUCTIONS_FILE_PATH, "utf-8");
}
