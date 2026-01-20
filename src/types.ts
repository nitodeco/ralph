export type AgentType = "cursor" | "claude";

export type PrdFormat = "json" | "yaml";

export interface RalphConfig {
	agent: AgentType;
	prdFormat?: PrdFormat;
	lastUpdateCheck?: number;
	skipVersion?: string;
	maxRetries?: number;
	retryDelayMs?: number;
}

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

export interface RunOptions {
	iterations: number;
}

export interface AgentResult {
	output: string;
	isComplete: boolean;
	exitCode: number;
}

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
