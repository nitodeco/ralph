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

export const VALID_SESSION_STATUSES: SessionStatus[] = [
	"running",
	"paused",
	"stopped",
	"completed",
];

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
}
