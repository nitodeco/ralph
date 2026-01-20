import type { AgentType, ConfigValidationResult, RalphConfig } from "@/types.ts";
import { GLOBAL_CONFIG_PATH, PROJECT_CONFIG_PATH } from "../paths.ts";
import { ConfigService } from "../services/ConfigService.ts";
import { AGENT_COMMANDS, CONFIG_DEFAULTS } from "./constants.ts";
import { validateConfig } from "./validator.ts";

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
	};
}

export function loadGlobalConfig(): RalphConfig {
	return ConfigService.loadGlobal();
}

export function loadGlobalConfigRaw(): Partial<RalphConfig> | null {
	return ConfigService.loadGlobalRaw();
}

export function saveGlobalConfig(config: RalphConfig): void {
	ConfigService.saveGlobal(config);
}

export function globalConfigExists(): boolean {
	return ConfigService.globalConfigExists();
}

export function loadConfig(): RalphConfig {
	return ConfigService.get();
}

export function loadProjectConfigRaw(): Partial<RalphConfig> | null {
	return ConfigService.loadProjectRaw();
}

export function loadConfigWithValidation(): {
	config: RalphConfig;
	validation: ConfigValidationResult;
} {
	return ConfigService.getWithValidation(validateConfig);
}

export function saveConfig(config: RalphConfig): void {
	ConfigService.saveProject(config);
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

export function getEffectiveConfig(): {
	global: Partial<RalphConfig> | null;
	project: Partial<RalphConfig> | null;
	effective: RalphConfig;
} {
	return ConfigService.getEffective();
}

export function invalidateConfigCache(): void {
	ConfigService.invalidateAll();
}
