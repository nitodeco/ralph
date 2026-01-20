import type { PromptGuardrail } from "@/types.ts";

export { DEFAULT_VERIFICATION, DEFAULTS } from "@/lib/services/config/constants.ts";

export function createDefaultGuardrails(): PromptGuardrail[] {
	const timestamp = new Date().toISOString();

	return [
		{
			id: "verify-before-commit",
			instruction: "Verify changes work before committing",
			trigger: "always",
			category: "quality",
			enabled: true,
			addedAt: timestamp,
		},
		{
			id: "read-existing-patterns",
			instruction: "Read existing code patterns before writing new code",
			trigger: "always",
			category: "quality",
			enabled: true,
			addedAt: timestamp,
		},
		{
			id: "fix-build-before-proceeding",
			instruction: "If build fails, fix it before proceeding",
			trigger: "always",
			category: "safety",
			enabled: true,
			addedAt: timestamp,
		},
	];
}
