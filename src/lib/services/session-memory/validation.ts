import type { SessionMemory } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => isString(item));
}

export function isSessionMemory(value: unknown): value is SessionMemory {
	if (!isObject(value)) {
		return false;
	}

	const {
		projectName,
		lessonsLearned,
		successfulPatterns,
		failedApproaches,
		taskNotes,
		lastUpdated,
	} = value;

	if (!isString(projectName)) {
		return false;
	}

	if (!isStringArray(lessonsLearned) || !isStringArray(successfulPatterns)) {
		return false;
	}

	if (!isStringArray(failedApproaches)) {
		return false;
	}

	if (!isObject(taskNotes) || !isString(lastUpdated)) {
		return false;
	}

	return true;
}
