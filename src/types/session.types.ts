import type { AgentType } from "@/lib/services/config/types.ts";

export type IterationLogStatus =
	| "running"
	| "completed"
	| "failed"
	| "stopped"
	| "verification_failed"
	| "decomposed";

export interface IterationLogTask {
	title: string;
	index: number;
	wasCompleted: boolean;
}

export interface ParallelTaskExecution {
	taskId: string;
	taskTitle: string;
	taskIndex: number;
	startedAt: string;
	completedAt: string | null;
	durationMs: number | null;
	status: "running" | "completed" | "failed";
	exitCode: number | null;
	retryCount: number;
	error: string | null;
}

export interface IterationLogParallelGroup {
	groupIndex: number;
	startedAt: string;
	completedAt: string | null;
	durationMs: number | null;
	taskExecutions: ParallelTaskExecution[];
	allSucceeded: boolean;
}

export interface IterationLogRetryContext {
	attemptNumber: number;
	failureCategory: string;
	rootCause: string;
	contextInjected: string;
}

export interface IterationLogAgent {
	type: AgentType;
	exitCode: number | null;
	retryCount: number;
	outputLength: number;
	retryContexts?: IterationLogRetryContext[];
}

export interface IterationLogError {
	timestamp: string;
	message: string;
	context?: Record<string, unknown>;
}

export interface IterationLogVerification {
	ran: boolean;
	passed: boolean;
	checks: Array<{
		name: string;
		passed: boolean;
		durationMs: number;
	}>;
	failedChecks: string[];
	totalDurationMs: number;
}

export interface IterationLogDecomposition {
	originalTaskTitle: string;
	reason: string;
	subtasksCreated: string[];
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
	verification?: IterationLogVerification;
	decomposition?: IterationLogDecomposition;
	isParallelExecution?: boolean;
	parallelGroup?: IterationLogParallelGroup;
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

export interface FailurePattern {
	pattern: string;
	category: string;
	occurrences: number;
	firstSeen: string;
	lastSeen: string;
	affectedTasks: string[];
	suggestedGuardrail: string | null;
	resolved: boolean;
}

export interface FailureHistoryEntry {
	timestamp: string;
	error: string;
	taskTitle: string;
	category: string;
	rootCause: string;
	exitCode: number | null;
	iteration: number;
}

export interface FailureHistory {
	entries: FailureHistoryEntry[];
	patterns: FailurePattern[];
	lastAnalyzedAt: string | null;
}
