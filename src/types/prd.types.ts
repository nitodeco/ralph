export type TaskPriority = "high" | "medium" | "low";

export interface PrdTask {
	title: string;
	description: string;
	steps: string[];
	done: boolean;
	dependsOn?: string[];
	priority?: TaskPriority;
}

export interface Prd {
	project: string;
	tasks: PrdTask[];
}

export interface DependencyValidationResult {
	valid: boolean;
	error?: string;
	circularPath?: string[];
}

export interface LoadPrdResult {
	prd: Prd | null;
	validationError?: string;
}
