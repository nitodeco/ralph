import type { Prd, PrdTask } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => isString(item));
}

function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

function isOptionalString(value: unknown): boolean {
	return value === undefined || isString(value);
}

function isOptionalStringArray(value: unknown): boolean {
	return value === undefined || isStringArray(value);
}

function isOptionalNumber(value: unknown): boolean {
	return value === undefined || isNumber(value);
}

export function isPrdTask(value: unknown): value is PrdTask {
	if (!isObject(value)) {
		return false;
	}

	const { id, title, description, steps, done, dependsOn, priority } = value;

	const hasRequiredFields =
		isString(title) && isString(description) && isStringArray(steps) && isBoolean(done);

	const hasValidOptionalFields =
		isOptionalString(id) && isOptionalStringArray(dependsOn) && isOptionalNumber(priority);

	return hasRequiredFields && hasValidOptionalFields;
}

export function isPrd(value: unknown): value is Prd {
	if (!isObject(value)) {
		return false;
	}

	const { project, tasks } = value;

	if (!isString(project) || project.trim() === "") {
		return false;
	}

	if (!Array.isArray(tasks)) {
		return false;
	}

	return tasks.every((task) => isPrdTask(task));
}
