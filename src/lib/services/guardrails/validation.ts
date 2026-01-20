import type { GuardrailsFile, PromptGuardrail } from "./types.ts";
import { VALID_GUARDRAIL_CATEGORIES, VALID_GUARDRAIL_TRIGGERS } from "./types.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

export function isPromptGuardrail(value: unknown): value is PromptGuardrail {
	if (!isObject(value)) {
		return false;
	}

	const { id, instruction, trigger, category, enabled, addedAt } = value;

	if (!isString(id) || !isString(instruction)) {
		return false;
	}

	if (
		!isString(trigger) ||
		!VALID_GUARDRAIL_TRIGGERS.includes(trigger as (typeof VALID_GUARDRAIL_TRIGGERS)[number])
	) {
		return false;
	}

	if (
		!isString(category) ||
		!VALID_GUARDRAIL_CATEGORIES.includes(category as (typeof VALID_GUARDRAIL_CATEGORIES)[number])
	) {
		return false;
	}

	if (!isBoolean(enabled) || !isString(addedAt)) {
		return false;
	}

	return true;
}

export function isGuardrailsFile(value: unknown): value is GuardrailsFile {
	if (!isObject(value)) {
		return false;
	}

	const { guardrails } = value;

	if (!Array.isArray(guardrails)) {
		return false;
	}

	return guardrails.every((guardrail) => isPromptGuardrail(guardrail));
}
