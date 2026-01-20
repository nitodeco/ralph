export type GuardrailTrigger = "always" | "on-error" | "on-task-type";
export type GuardrailCategory = "safety" | "quality" | "style" | "process";

export interface PromptGuardrail {
	id: string;
	instruction: string;
	trigger: GuardrailTrigger;
	category: GuardrailCategory;
	enabled: boolean;
	addedAt: string;
	addedAfterFailure?: string;
}

export interface CheckResult {
	name: string;
	passed: boolean;
	output: string;
	durationMs: number;
}

export interface VerificationResult {
	passed: boolean;
	checks: CheckResult[];
	failedChecks: string[];
	totalDurationMs: number;
}
