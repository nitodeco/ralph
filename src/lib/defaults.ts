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
} as const;
