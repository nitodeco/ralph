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

export function isPrdTask(value: unknown): value is PrdTask {
	if (!isObject(value)) {
		return false;
	}

	const { title, description, steps, done } = value;

	return isString(title) && isString(description) && isStringArray(steps) && isBoolean(done);
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
