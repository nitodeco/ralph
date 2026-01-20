import type { PromptGuardrail, VerificationConfig } from "@/types.ts";

export const DEFAULTS = {
	agent: "cursor" as const,
	maxRetries: 3,
	retryDelayMs: 5000,
	agentTimeoutMs: 30 * 60 * 1000,
	stuckThresholdMs: 5 * 60 * 1000,
	maxOutputBufferBytes: 5 * 1024 * 1024,
	memoryWarningThresholdMb: 500,
	enableGcHints: true,
	logFilePath: ".ralph/ralph.log",
	iterationDelayMs: 2000,
	iterations: 10,
	retryWithContext: true,
	maxDecompositionsPerTask: 2,
	learningEnabled: true,
} as const;

export const DEFAULT_VERIFICATION: VerificationConfig = {
	enabled: false,
	failOnWarning: false,
};

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
