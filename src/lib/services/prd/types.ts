export interface PrdTask {
	title: string;
	description: string;
	steps: string[];
	done: boolean;
}

export interface Prd {
	project: string;
	tasks: PrdTask[];
}

export interface LoadPrdResult {
	prd: Prd | null;
	validationError?: string;
}

export interface DecompositionSubtask {
	title: string;
	description: string;
	steps: string[];
}

export interface DecompositionRequest {
	originalTaskTitle: string;
	reason: string;
	suggestedSubtasks: DecompositionSubtask[];
}

export interface TaskWithIndex {
	title: string;
	index: number;
}

export interface CanWorkResult {
	canWork: boolean;
	reason?: string;
}

export interface PrdService {
	get(verbose?: boolean): Prd | null;
	load(verbose?: boolean): Prd | null;
	loadWithValidation(): LoadPrdResult;
	reload(verbose?: boolean): Prd | null;
	reloadWithValidation(): LoadPrdResult;
	save(prd: Prd): void;
	invalidate(): void;
	findFile(): string | null;
	isComplete(prd: Prd): boolean;
	getNextTask(prd: Prd): string | null;
	getNextTaskWithIndex(prd: Prd): TaskWithIndex | null;
	getTaskByTitle(prd: Prd, title: string): PrdTask | null;
	getTaskByIndex(prd: Prd, index: number): PrdTask | null;
	getCurrentTaskIndex(prd: Prd): number;
	canWorkOnTask(task: PrdTask): CanWorkResult;
	createEmpty(projectName: string): Prd;
	loadInstructions(): string | null;
}
