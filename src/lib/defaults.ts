import type { PromptGuardrail } from "@/types/config.types.ts";

export const DEFAULTS = {
	agent: "cursor" as const,
	prdFormat: "json" as const,
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
} as const;

export const DEFAULT_GUARDRAILS: PromptGuardrail[] = [
	{
		id: "verify-before-commit",
		instruction: "Verify changes work before committing",
		trigger: "always",
		category: "quality",
		enabled: true,
		addedAt: new Date().toISOString(),
	},
	{
		id: "read-existing-patterns",
		instruction: "Read existing code patterns before writing new code",
		trigger: "always",
		category: "quality",
		enabled: true,
		addedAt: new Date().toISOString(),
	},
	{
		id: "fix-build-before-proceeding",
		instruction: "If build fails, fix it before proceeding",
		trigger: "always",
		category: "safety",
		enabled: true,
		addedAt: new Date().toISOString(),
	},
];
