export type AppState =
	| "idle"
	| "running"
	| "complete"
	| "error"
	| "max_iterations"
	| "max_runtime"
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
	| "archive"
	| "guardrails"
	| "analyze"
	| "memory";

export interface ValidationWarning {
	message: string;
	hint: string;
}

export interface SetManualTaskResult {
	success: boolean;
	error?: string;
	taskTitle?: string;
}
