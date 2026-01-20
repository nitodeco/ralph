import type { PromptGuardrail } from "./types.ts";

export function formatGuardrailsForPrompt(guardrails: PromptGuardrail[]): string {
	if (guardrails.length === 0) {
		return "";
	}

	const formattedRules = guardrails
		.map((guardrail, index) => `${index + 1}. ${guardrail.instruction}`)
		.join("\n");

	return `## Guardrails\n${formattedRules}\n`;
}
