import type { ConfigValidationResult, RalphConfig } from "@/types.ts";
import { ConfigService } from "../services/ConfigService.ts";
import { validateConfig } from "./validator.ts";

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
