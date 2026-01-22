import type { CustomRule } from "./types.ts";

export function formatRulesForPrompt(rules: CustomRule[]): string {
	if (rules.length === 0) {
		return "";
	}

	const formattedRules = rules.map((rule, index) => `${index + 1}. ${rule.instruction}`).join("\n");

	return `## Custom Rules\n${formattedRules}\n`;
}
