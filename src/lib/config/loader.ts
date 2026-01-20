import type { AgentType, RalphConfig } from "@/types.ts";
import { AGENT_COMMANDS, CONFIG_DEFAULTS } from "../constants/config.ts";
import { GLOBAL_CONFIG_PATH, PROJECT_CONFIG_PATH } from "../paths.ts";

export function applyDefaults(config: Partial<RalphConfig>): RalphConfig {
	const defaults = CONFIG_DEFAULTS;

	return {
		agent: config.agent ?? defaults.agent,
		prdFormat: config.prdFormat ?? defaults.prdFormat,
		maxRetries: config.maxRetries ?? defaults.maxRetries,
		retryDelayMs: config.retryDelayMs ?? defaults.retryDelayMs,
		logFilePath: config.logFilePath ?? defaults.logFilePath,
		agentTimeoutMs: config.agentTimeoutMs ?? defaults.agentTimeoutMs,
		stuckThresholdMs: config.stuckThresholdMs ?? defaults.stuckThresholdMs,
		lastUpdateCheck: config.lastUpdateCheck,
		skipVersion: config.skipVersion,
		notifications: config.notifications
			? { ...defaults.notifications, ...config.notifications }
			: defaults.notifications,
		memory: config.memory ? { ...defaults.memory, ...config.memory } : defaults.memory,
		maxOutputHistoryBytes: config.maxOutputHistoryBytes ?? defaults.maxOutputHistoryBytes,
		retryWithContext: config.retryWithContext ?? defaults.retryWithContext,
		verification: config.verification
			? { ...defaults.verification, ...config.verification }
			: defaults.verification,
		maxDecompositionsPerTask: config.maxDecompositionsPerTask ?? defaults.maxDecompositionsPerTask,
		learningEnabled: config.learningEnabled ?? defaults.learningEnabled,
	};
}

export function getAgentCommand(agentType: AgentType): string[] {
	return AGENT_COMMANDS[agentType];
}

export function getGlobalConfigPath(): string {
	return GLOBAL_CONFIG_PATH;
}

export function getProjectConfigPath(): string {
	return PROJECT_CONFIG_PATH;
}
