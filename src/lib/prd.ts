import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type {
	DependencyValidationResult,
	LoadPrdResult,
	Prd,
	PrdTask,
} from "@/types.ts";
import { RALPH_DIR } from "./paths.ts";

export type { DependencyValidationResult, LoadPrdResult } from "@/types.ts";
export { ensureRalphDirExists, RALPH_DIR } from "./paths.ts";

export const INSTRUCTIONS_FILE_PATH = `${RALPH_DIR}/instructions.md`;
const PRD_JSON_PATH = `${RALPH_DIR}/prd.json`;
const PRD_YAML_PATH = `${RALPH_DIR}/prd.yaml`;

export function findPrdFile(): string | null {
	if (existsSync(PRD_JSON_PATH)) {
		return PRD_JSON_PATH;
	}
	if (existsSync(PRD_YAML_PATH)) {
		return PRD_YAML_PATH;
	}
	return null;
}

export function loadPrd(skipValidation = false): Prd | null {
	const result = loadPrdWithValidation(skipValidation);
	if (result.validationError) {
		console.error(`PRD validation error: ${result.validationError}`);
	}
	return result.prd;
}

export function loadPrdWithValidation(skipValidation = false): LoadPrdResult {
	const prdPath = findPrdFile();
	if (!prdPath) {
		return { prd: null };
	}

	const content = readFileSync(prdPath, "utf-8");

	let prd: Prd;
	if (prdPath.endsWith(".yaml") || prdPath.endsWith(".yml")) {
		prd = parseYaml(content) as Prd;
	} else {
		prd = JSON.parse(content) as Prd;
	}

	if (!skipValidation) {
		const validationResult = validateDependencies(prd);
		if (!validationResult.valid) {
			return { prd: null, validationError: validationResult.error };
		}
	}

	return { prd };
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

function areDependenciesSatisfied(task: PrdTask, prd: Prd): boolean {
	if (!task.dependsOn || task.dependsOn.length === 0) {
		return true;
	}

	const taskTitleMap = new Map<string, PrdTask>();
	for (const prdTask of prd.tasks) {
		taskTitleMap.set(prdTask.title.toLowerCase(), prdTask);
	}

	for (const dependency of task.dependsOn) {
		const dependentTask = taskTitleMap.get(dependency.toLowerCase());
		if (!dependentTask || !dependentTask.done) {
			return false;
		}
	}

	return true;
}

export function getNextTask(prd: Prd): string | null {
	const availableTasks = prd.tasks.filter(
		(task) => !task.done && areDependenciesSatisfied(task, prd),
	);

	if (availableTasks.length === 0) {
		return null;
	}

	const nextTask = availableTasks[0];
	return nextTask ? nextTask.title : null;
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

export function canWorkOnTask(prd: Prd, task: PrdTask): { canWork: boolean; reason?: string } {
	if (task.done) {
		return { canWork: false, reason: "Task is already completed" };
	}

	if (!areDependenciesSatisfied(task, prd)) {
		const unmetDeps = task.dependsOn?.filter((depTitle) => {
			const depTask = prd.tasks.find(
				(prdTask) => prdTask.title.toLowerCase() === depTitle.toLowerCase(),
			);
			return !depTask?.done;
		});
		return {
			canWork: false,
			reason: `Task has unmet dependencies: ${unmetDeps?.join(", ")}`,
		};
	}

	return { canWork: true };
}

export function validateDependencies(prd: Prd): DependencyValidationResult {
	const taskTitles = new Set<string>(prd.tasks.map((task) => task.title.toLowerCase()));
	const taskTitleMap = new Map<string, PrdTask>();
	for (const task of prd.tasks) {
		taskTitleMap.set(task.title.toLowerCase(), task);
	}

	for (const task of prd.tasks) {
		if (!task.dependsOn) continue;

		for (const dependency of task.dependsOn) {
			if (!taskTitles.has(dependency.toLowerCase())) {
				return {
					valid: false,
					error: `Task "${task.title}" depends on unknown task "${dependency}"`,
				};
			}
		}
	}

	const visited = new Set<string>();
	const recursionStack = new Set<string>();
	const path: string[] = [];

	function detectCycle(taskTitle: string): boolean {
		const normalizedTitle = taskTitle.toLowerCase();
		visited.add(normalizedTitle);
		recursionStack.add(normalizedTitle);
		path.push(taskTitle);

		const task = taskTitleMap.get(normalizedTitle);
		if (task?.dependsOn) {
			for (const dependency of task.dependsOn) {
				const normalizedDep = dependency.toLowerCase();
				if (!visited.has(normalizedDep)) {
					if (detectCycle(dependency)) {
						return true;
					}
				} else if (recursionStack.has(normalizedDep)) {
					path.push(dependency);
					return true;
				}
			}
		}

		path.pop();
		recursionStack.delete(normalizedTitle);
		return false;
	}

	for (const task of prd.tasks) {
		visited.clear();
		recursionStack.clear();
		path.length = 0;

		if (detectCycle(task.title)) {
			const lastPath = path[path.length - 1];
			const cycleStartIndex = lastPath
				? path.findIndex((pathTitle) => pathTitle.toLowerCase() === lastPath.toLowerCase())
				: 0;
			const cyclePath = path.slice(cycleStartIndex);

			return {
				valid: false,
				error: `Circular dependency detected: ${cyclePath.join(" → ")}`,
				circularPath: cyclePath,
			};
		}
	}

	return { valid: true };
}

export function getTaskDependencies(task: PrdTask, prd: Prd): PrdTask[] {
	if (!task.dependsOn || task.dependsOn.length === 0) {
		return [];
	}

	const taskTitleMap = new Map<string, PrdTask>();
	for (const prdTask of prd.tasks) {
		taskTitleMap.set(prdTask.title.toLowerCase(), prdTask);
	}

	const dependencies: PrdTask[] = [];
	for (const depTitle of task.dependsOn) {
		const depTask = taskTitleMap.get(depTitle.toLowerCase());
		if (depTask) {
			dependencies.push(depTask);
		}
	}

	return dependencies;
}

export function getTaskDependents(task: PrdTask, prd: Prd): PrdTask[] {
	const normalizedTitle = task.title.toLowerCase();

	return prd.tasks.filter(
		(prdTask) => prdTask.dependsOn?.some((dep) => dep.toLowerCase() === normalizedTitle) ?? false,
	);
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
