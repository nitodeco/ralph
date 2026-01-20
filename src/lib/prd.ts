import type {
	CanWorkResult,
	LoadPrdResult,
	Prd,
	PrdTask,
	TaskWithIndex,
} from "@/lib/services/index.ts";
import { getPrdService } from "@/lib/services/index.ts";

export { INSTRUCTIONS_FILE_PATH } from "./paths.ts";

export function findPrdFile(): string | null {
	return getPrdService().findFile();
}

export function loadPrd(verbose = false): Prd | null {
	return getPrdService().get(verbose);
}

export function loadPrdWithValidation(): LoadPrdResult {
	return getPrdService().loadWithValidation();
}

export function savePrd(prd: Prd): void {
	getPrdService().save(prd);
}

export function reloadPrd(verbose = false): Prd | null {
	return getPrdService().reload(verbose);
}

export function invalidatePrdCache(): void {
	getPrdService().invalidate();
}

export function isPrdComplete(prd: Prd): boolean {
	return getPrdService().isComplete(prd);
}

export function getNextTask(prd: Prd): string | null {
	return getPrdService().getNextTask(prd);
}

export function getNextTaskWithIndex(prd: Prd): TaskWithIndex | null {
	return getPrdService().getNextTaskWithIndex(prd);
}

export function getTaskByTitle(prd: Prd, title: string): PrdTask | null {
	return getPrdService().getTaskByTitle(prd, title);
}

export function getTaskByIndex(prd: Prd, index: number): PrdTask | null {
	return getPrdService().getTaskByIndex(prd, index);
}

export function getCurrentTaskIndex(prd: Prd): number {
	return getPrdService().getCurrentTaskIndex(prd);
}

export function canWorkOnTask(task: PrdTask): CanWorkResult {
	return getPrdService().canWorkOnTask(task);
}

export function createEmptyPrd(projectName: string): Prd {
	return getPrdService().createEmpty(projectName);
}

export function loadInstructions(): string | null {
	return getPrdService().loadInstructions();
}
