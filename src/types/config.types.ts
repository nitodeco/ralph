export type AgentType = "cursor" | "claude" | "codex";

export type PrdFormat = "json" | "yaml";

export interface NotificationConfig {
	systemNotification?: boolean;
	webhookUrl?: string;
	markerFilePath?: string;
}

export type NotificationEvent = "complete" | "max_iterations" | "fatal_error";

export interface MemoryConfig {
	maxOutputBufferBytes?: number;
	memoryWarningThresholdMb?: number;
	enableGarbageCollectionHints?: boolean;
}

export interface RalphConfig {
	agent: AgentType;
	prdFormat?: PrdFormat;
	lastUpdateCheck?: number;
	skipVersion?: string;
	maxRetries?: number;
	retryDelayMs?: number;
	logFilePath?: string;
	agentTimeoutMs?: number;
	stuckThresholdMs?: number;
	notifications?: NotificationConfig;
	memory?: MemoryConfig;
	maxOutputHistoryBytes?: number;
	maxRuntimeMs?: number;
	retryWithContext?: boolean;
	verification?: VerificationConfig;
	maxDecompositionsPerTask?: number;
}

export interface ConfigValidationError {
	field: string;
	message: string;
	value?: unknown;
}

export interface ConfigValidationResult {
	valid: boolean;
	errors: ConfigValidationError[];
	warnings: ConfigValidationError[];
}

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

export interface VerificationConfig {
	enabled: boolean;
	buildCommand?: string;
	testCommand?: string;
	lintCommand?: string;
	customChecks?: string[];
	failOnWarning: boolean;
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
