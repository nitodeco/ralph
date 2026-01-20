export type SessionStatus = "running" | "paused" | "stopped" | "completed";

export interface Session {
	startTime: number;
	lastUpdateTime: number;
	currentIteration: number;
	totalIterations: number;
	currentTaskIndex: number;
	status: SessionStatus;
	elapsedTimeSeconds: number;
}

export type ProgressEntryType =
	| "session_start"
	| "session_resume"
	| "iteration_start"
	| "iteration_complete"
	| "task_complete"
	| "error"
	| "retry"
	| "session_complete"
	| "session_stopped"
	| "max_iterations";

export interface ProgressEntry {
	timestamp: string;
	type: ProgressEntryType;
	iteration?: number;
	totalIterations?: number;
	message: string;
	context?: Record<string, unknown>;
}

export interface SessionSummary {
	projectName: string;
	startedAt: string;
	lastUpdatedAt: string;
	totalIterations: number;
	completedIterations: number;
	tasksCompleted: number;
	totalTasks: number;
	status: string;
}
