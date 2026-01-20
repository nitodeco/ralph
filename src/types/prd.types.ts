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
