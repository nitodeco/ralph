import type { AgentType, RalphConfig, VerificationConfig } from "./types.ts";

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

export const CONFIG_DEFAULTS: Required<Omit<RalphConfig, "lastUpdateCheck" | "skipVersion">> = {
	agent: DEFAULTS.agent,
	maxRetries: DEFAULTS.maxRetries,
	retryDelayMs: DEFAULTS.retryDelayMs,
	logFilePath: DEFAULTS.logFilePath,
	agentTimeoutMs: DEFAULTS.agentTimeoutMs,
	stuckThresholdMs: DEFAULTS.stuckThresholdMs,
	notifications: {
		systemNotification: false,
		webhookUrl: undefined,
		markerFilePath: undefined,
	},
	memory: {
		maxOutputBufferBytes: DEFAULTS.maxOutputBufferBytes,
		memoryWarningThresholdMb: DEFAULTS.memoryWarningThresholdMb,
		enableGarbageCollectionHints: DEFAULTS.enableGcHints,
	},
	maxOutputHistoryBytes: DEFAULTS.maxOutputBufferBytes,
	maxRuntimeMs: 0,
	retryWithContext: DEFAULTS.retryWithContext,
	verification: DEFAULT_VERIFICATION,
	maxDecompositionsPerTask: DEFAULTS.maxDecompositionsPerTask,
	learningEnabled: DEFAULTS.learningEnabled,
};

export const DEFAULT_CONFIG: RalphConfig = {
	agent: DEFAULTS.agent,
	maxRetries: DEFAULTS.maxRetries,
	retryDelayMs: DEFAULTS.retryDelayMs,
};

export const VALID_AGENTS: AgentType[] = ["cursor", "claude", "codex"];

export const DEFAULT_AGENT_TIMEOUT_MS = DEFAULTS.agentTimeoutMs;
export const DEFAULT_STUCK_THRESHOLD_MS = DEFAULTS.stuckThresholdMs;
export const DEFAULT_MAX_OUTPUT_BUFFER_BYTES = DEFAULTS.maxOutputBufferBytes;
export const DEFAULT_MEMORY_WARNING_THRESHOLD_MB = DEFAULTS.memoryWarningThresholdMb;
export const DEFAULT_ENABLE_GC_HINTS = DEFAULTS.enableGcHints;

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
	cursor: ["agent", "-p", "--force", "--output-format", "stream-json", "--stream-partial-output"],
	claude: ["claude", "-p", "--dangerously-skip-permissions"],
	codex: ["codex", "-q", "--approval-mode", "full-auto"],
};
