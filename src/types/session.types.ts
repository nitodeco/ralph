import type { AgentType } from "./config.types.ts";

export type SessionStatus = "running" | "paused" | "stopped" | "completed";

export interface IterationTiming {
	iteration: number;
	startTime: number;
	endTime: number | null;
	durationMs: number | null;
}

export interface SessionStatistics {
	totalIterations: number;
	completedIterations: number;
	failedIterations: number;
	successfulIterations: number;
	totalDurationMs: number;
	averageDurationMs: number;
	successRate: number;
	iterationTimings: IterationTiming[];
}

export interface Session {
	startTime: number;
	lastUpdateTime: number;
	currentIteration: number;
	totalIterations: number;
	currentTaskIndex: number;
	status: SessionStatus;
	elapsedTimeSeconds: number;
	statistics: SessionStatistics;
}

export type IterationLogStatus = "running" | "completed" | "failed" | "stopped";

export interface IterationLogTask {
	title: string;
	index: number;
	wasCompleted: boolean;
}

export interface IterationLogAgent {
	type: AgentType;
	exitCode: number | null;
	retryCount: number;
	outputLength: number;
}

export interface IterationLogError {
	timestamp: string;
	message: string;
	context?: Record<string, unknown>;
}

export interface IterationLog {
	iteration: number;
	totalIterations: number;
	startedAt: string;
	completedAt: string | null;
	durationMs: number | null;
	status: IterationLogStatus;
	task: IterationLogTask | null;
	agent: IterationLogAgent;
	errors: IterationLogError[];
}

export interface IterationLogsIndexEntry {
	iteration: number;
	status: IterationLogStatus;
	filename: string;
}

export interface IterationLogsIndex {
	sessionId: string;
	projectName: string;
	startedAt: string;
	lastUpdatedAt: string;
	iterations: IterationLogsIndexEntry[];
}
