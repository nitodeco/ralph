import { type Session, type SessionStatus, VALID_SESSION_STATUSES } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

export function isSessionStatus(value: unknown): value is SessionStatus {
	return isString(value) && VALID_SESSION_STATUSES.includes(value as SessionStatus);
}

export function isSession(value: unknown): value is Session {
	if (!isObject(value)) {
		return false;
	}

	const {
		startTime,
		lastUpdateTime,
		currentIteration,
		totalIterations,
		currentTaskIndex,
		status,
		elapsedTimeSeconds,
		statistics,
	} = value;

	if (!isNumber(startTime) || !isNumber(lastUpdateTime)) {
		return false;
	}

	if (!isNumber(currentIteration) || !isNumber(totalIterations)) {
		return false;
	}

	if (!isNumber(currentTaskIndex) || !isNumber(elapsedTimeSeconds)) {
		return false;
	}

	if (!isSessionStatus(status)) {
		return false;
	}

	if (!isObject(statistics)) {
		return false;
	}

	return true;
}
