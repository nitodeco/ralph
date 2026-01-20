import { existsSync, readFileSync } from "node:fs";
import type { LoadPrdResult, Prd, PrdTask } from "@/types.ts";
import { INSTRUCTIONS_FILE_PATH } from "./paths.ts";
import { PrdService } from "./services/PrdService.ts";

export { INSTRUCTIONS_FILE_PATH } from "./paths.ts";

export function findPrdFile(): string | null {
	return PrdService.findPrdFile();
}

export function loadPrd(verbose = false): Prd | null {
	return PrdService.get(verbose);
}

export function loadPrdWithValidation(): LoadPrdResult {
	return PrdService.loadWithValidation();
}

export function savePrd(prd: Prd, format: "json" | "yaml" = "json"): void {
	PrdService.save(prd, format);
}

export function reloadPrd(verbose = false): Prd | null {
	return PrdService.reload(verbose);
}

export function invalidatePrdCache(): void {
	PrdService.invalidate();
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
