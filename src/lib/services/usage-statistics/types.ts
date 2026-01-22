export interface SessionRecord {
	id: string;
	startedAt: string;
	completedAt: string | null;
	durationMs: number;
	totalIterations: number;
	completedIterations: number;
	successfulIterations: number;
	failedIterations: number;
	tasksCompleted: number;
	tasksAttempted: number;
	status: "completed" | "stopped" | "failed";
}

export interface DailyUsage {
	date: string;
	sessionsStarted: number;
	iterationsRun: number;
	tasksCompleted: number;
	totalDurationMs: number;
}

export interface UsageStatistics {
	version: number;
	projectName: string;
	createdAt: string;
	lastUpdatedAt: string;
	lifetime: {
		totalSessions: number;
		totalIterations: number;
		totalTasksCompleted: number;
		totalTasksAttempted: number;
		totalDurationMs: number;
		successfulIterations: number;
		failedIterations: number;
		averageIterationsPerSession: number;
		averageTasksPerSession: number;
		averageSessionDurationMs: number;
		overallSuccessRate: number;
	};
	recentSessions: SessionRecord[];
	dailyUsage: DailyUsage[];
}

export interface UsageStatisticsSummary {
	totalSessions: number;
	totalIterations: number;
	totalTasksCompleted: number;
	totalDurationMs: number;
	overallSuccessRate: number;
	averageSessionDurationMs: number;
	averageIterationsPerSession: number;
	lastSessionAt: string | null;
	streakDays: number;
}

export interface RecordSessionOptions {
	sessionId: string;
	startedAt: string;
	completedAt: string | null;
	durationMs: number;
	totalIterations: number;
	completedIterations: number;
	successfulIterations: number;
	failedIterations: number;
	tasksCompleted: number;
	tasksAttempted: number;
	status: "completed" | "stopped" | "failed";
}

export const USAGE_STATISTICS_CONSTANTS = {
	VERSION: 1,
	MAX_RECENT_SESSIONS: 50,
	MAX_DAILY_USAGE_DAYS: 90,
} as const;

export interface UsageStatisticsService {
	get(): UsageStatistics;
	load(): UsageStatistics;
	save(statistics: UsageStatistics): void;
	exists(): boolean;
	initialize(projectName: string): UsageStatistics;
	invalidate(): void;

	recordSession(options: RecordSessionOptions): void;
	getSummary(): UsageStatisticsSummary;
	getRecentSessions(limit?: number): SessionRecord[];
	getDailyUsage(days?: number): DailyUsage[];

	formatForDisplay(): string;
}
