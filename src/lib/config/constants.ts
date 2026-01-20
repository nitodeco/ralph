import type { AgentType, PrdFormat, RalphConfig } from "@/types.ts";
import { DEFAULTS } from "../defaults.ts";

export const CONFIG_DEFAULTS: Required<Omit<RalphConfig, "lastUpdateCheck" | "skipVersion">> = {
	agent: DEFAULTS.agent,
	prdFormat: DEFAULTS.prdFormat,
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
};

export const DEFAULT_CONFIG: RalphConfig = {
	agent: DEFAULTS.agent,
	prdFormat: DEFAULTS.prdFormat,
	maxRetries: DEFAULTS.maxRetries,
	retryDelayMs: DEFAULTS.retryDelayMs,
};

export const VALID_AGENTS: AgentType[] = ["cursor", "claude"];
export const VALID_PRD_FORMATS: PrdFormat[] = ["json", "yaml"];

export const DEFAULT_AGENT_TIMEOUT_MS = DEFAULTS.agentTimeoutMs;
export const DEFAULT_STUCK_THRESHOLD_MS = DEFAULTS.stuckThresholdMs;
export const DEFAULT_MAX_OUTPUT_BUFFER_BYTES = DEFAULTS.maxOutputBufferBytes;
export const DEFAULT_MEMORY_WARNING_THRESHOLD_MB = DEFAULTS.memoryWarningThresholdMb;
export const DEFAULT_ENABLE_GC_HINTS = DEFAULTS.enableGcHints;

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
	cursor: ["agent", "-p", "--force", "--output-format", "stream-json", "--stream-partial-output"],
	claude: ["claude", "-p", "--dangerously-skip-permissions"],
};
