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
