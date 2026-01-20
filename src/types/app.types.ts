export type AppState =
	| "idle"
	| "running"
	| "complete"
	| "error"
	| "max_iterations"
	| "not_initialized"
	| "resume_prompt";

export type ActiveView =
	| "run"
	| "init"
	| "setup"
	| "update"
	| "help"
	| "add"
	| "status"
	| "archive";

export interface ValidationWarning {
	message: string;
	hint: string;
}

export interface SetManualTaskResult {
	success: boolean;
	error?: string;
	taskTitle?: string;
}
