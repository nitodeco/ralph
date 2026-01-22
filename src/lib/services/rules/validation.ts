import type { CustomRule, RulesFile } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

export function isCustomRule(value: unknown): value is CustomRule {
	if (!isObject(value)) {
		return false;
	}

	const { id, instruction, addedAt } = value;

	if (!isString(id) || !isString(instruction) || !isString(addedAt)) {
		return false;
	}

	return true;
}

export function isRulesFile(value: unknown): value is RulesFile {
	if (!isObject(value)) {
		return false;
	}

	const { rules } = value;

	if (!Array.isArray(rules)) {
		return false;
	}

	return rules.every((rule) => isCustomRule(rule));
}
