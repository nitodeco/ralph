import type { DailyUsage, SessionRecord, UsageStatistics } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

function isSessionStatus(value: unknown): value is SessionRecord["status"] {
	return value === "completed" || value === "stopped" || value === "failed";
}

export function isSessionRecord(value: unknown): value is SessionRecord {
	if (!isObject(value)) {
		return false;
	}

	const { id, startedAt, completedAt, durationMs, totalIterations, status } = value;

	if (!isString(id) || !isString(startedAt)) {
		return false;
	}

	if (completedAt !== null && !isString(completedAt)) {
		return false;
	}

	if (!isNumber(durationMs) || !isNumber(totalIterations)) {
		return false;
	}

	if (!isSessionStatus(status)) {
		return false;
	}

	return true;
}

export function isDailyUsage(value: unknown): value is DailyUsage {
	if (!isObject(value)) {
		return false;
	}

	const { date, sessionsStarted, iterationsRun, tasksCompleted, totalDurationMs } = value;

	if (!isString(date)) {
		return false;
	}

	if (!isNumber(sessionsStarted) || !isNumber(iterationsRun)) {
		return false;
	}

	if (!isNumber(tasksCompleted) || !isNumber(totalDurationMs)) {
		return false;
	}

	return true;
}

export function isUsageStatistics(value: unknown): value is UsageStatistics {
	if (!isObject(value)) {
		return false;
	}

	const { version, projectName, createdAt, lastUpdatedAt, lifetime, recentSessions, dailyUsage } =
		value;

	if (!isNumber(version) || !isString(projectName)) {
		return false;
	}

	if (!isString(createdAt) || !isString(lastUpdatedAt)) {
		return false;
	}

	if (!isObject(lifetime)) {
		return false;
	}

	const {
		totalSessions,
		totalIterations,
		totalTasksCompleted,
		totalDurationMs,
		overallSuccessRate,
	} = lifetime;

	if (!isNumber(totalSessions) || !isNumber(totalIterations)) {
		return false;
	}

	if (!isNumber(totalTasksCompleted) || !isNumber(totalDurationMs)) {
		return false;
	}

	if (!isNumber(overallSuccessRate)) {
		return false;
	}

	if (!Array.isArray(recentSessions)) {
		return false;
	}

	if (!recentSessions.every((session) => isSessionRecord(session))) {
		return false;
	}

	if (!Array.isArray(dailyUsage)) {
		return false;
	}

	if (!dailyUsage.every((usage) => isDailyUsage(usage))) {
		return false;
	}

	return true;
}
