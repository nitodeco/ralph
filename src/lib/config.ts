import { existsSync } from "node:fs";
import { GLOBAL_CONFIG_PATH } from "./paths.ts";
import type { RalphConfig } from "./services/config/types.ts";
import { validateConfig } from "./services/config/validation.ts";
import { getConfigService } from "./services/index.ts";

export { getProjectConfigPath } from "./paths.ts";
export {
	AGENT_COMMANDS,
	CONFIG_DEFAULTS,
	DEFAULT_AGENT_TIMEOUT_MS,
	DEFAULT_CONFIG,
	DEFAULT_ENABLE_GC_HINTS,
	DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
	DEFAULT_MEMORY_WARNING_THRESHOLD_MB,
	DEFAULT_STUCK_THRESHOLD_MS,
	VALID_AGENTS,
} from "./services/config/constants.ts";
export {
	formatBytes,
	formatMs,
	formatValidationErrors,
	getConfigSummary,
} from "./services/config/formatter.ts";
export {
	applyDefaults,
	getAgentCommand,
	getGlobalConfigPath,
} from "./services/config/implementation.ts";

export { validateConfig } from "./services/config/validation.ts";

export function loadGlobalConfig(): RalphConfig {
	return getConfigService().loadGlobal();
}

export function loadGlobalConfigRaw(): Partial<RalphConfig> | null {
	return getConfigService().loadGlobalRaw();
}

export function saveGlobalConfig(config: RalphConfig): void {
	getConfigService().saveGlobal(config);
}

export function globalConfigExists(): boolean {
	return existsSync(GLOBAL_CONFIG_PATH);
}

export function loadConfig(): RalphConfig {
	return getConfigService().get();
}

export function loadProjectConfigRaw(): Partial<RalphConfig> | null {
	return getConfigService().loadProjectRaw();
}

export function loadConfigWithValidation() {
	return getConfigService().getWithValidation(validateConfig);
}

export function saveConfig(config: RalphConfig): void {
	getConfigService().saveProject(config);
}

export function getEffectiveConfig() {
	return getConfigService().getEffective();
}

export function invalidateConfigCache(): void {
	getConfigService().invalidateAll();
}
