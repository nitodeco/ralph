export type SessionStatus = "running" | "paused" | "stopped" | "completed";

export type TaskExecutionStatus = "pending" | "running" | "completed" | "failed";

export interface IterationTiming {
	iteration: number;
	startTime: number;
	endTime: number | null;
	durationMs: number | null;
}

export interface ActiveTaskExecution {
	taskId: string;
	taskTitle: string;
	taskIndex: number;
	status: TaskExecutionStatus;
	startTime: number;
	endTime: number | null;
	processId: string;
	retryCount: number;
	lastError: string | null;
}

export interface ParallelExecutionGroup {
	groupIndex: number;
	startTime: number;
	endTime: number | null;
	taskExecutions: ActiveTaskExecution[];
	isComplete: boolean;
}

export interface ParallelSessionState {
	isParallelMode: boolean;
	currentGroupIndex: number;
	executionGroups: ParallelExecutionGroup[];
	activeExecutions: ActiveTaskExecution[];
	maxConcurrentTasks: number;
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
	parallelState?: ParallelSessionState;
}

export const VALID_SESSION_STATUSES: SessionStatus[] = [
	"running",
	"paused",
	"stopped",
	"completed",
];

export const VALID_TASK_EXECUTION_STATUSES: TaskExecutionStatus[] = [
	"pending",
	"running",
	"completed",
	"failed",
];

export interface TaskExecutionInfo {
	taskId: string;
	taskTitle: string;
	taskIndex: number;
	processId: string;
}

export interface SessionService {
	load(): Session | null;
	save(session: Session): void;
	delete(): void;
	exists(): boolean;

	create(totalIterations: number, currentTaskIndex: number): Session;
	recordIterationStart(session: Session, iteration: number): Session;
	recordIterationEnd(session: Session, iteration: number, wasSuccessful: boolean): Session;
	updateIteration(
		session: Session,
		currentIteration: number,
		currentTaskIndex: number,
		elapsedTimeSeconds: number,
	): Session;
	updateStatus(session: Session, status: SessionStatus): Session;
	isResumable(session: Session | null): boolean;

	enableParallelMode(session: Session, maxConcurrentTasks: number): Session;
	disableParallelMode(session: Session): Session;
	isParallelMode(session: Session): boolean;

	startParallelGroup(session: Session, groupIndex: number): Session;
	completeParallelGroup(session: Session, groupIndex: number): Session;
	getCurrentParallelGroup(session: Session): ParallelExecutionGroup | null;

	startTaskExecution(session: Session, taskInfo: TaskExecutionInfo): Session;
	completeTaskExecution(session: Session, taskId: string, wasSuccessful: boolean): Session;
	failTaskExecution(session: Session, taskId: string, error: string): Session;
	retryTaskExecution(session: Session, taskId: string): Session;

	getActiveExecutions(session: Session): ActiveTaskExecution[];
	getTaskExecution(session: Session, taskId: string): ActiveTaskExecution | null;
	isTaskExecuting(session: Session, taskId: string): boolean;
	getActiveExecutionCount(session: Session): number;
}
