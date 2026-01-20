import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ConfigValidationResult, RalphConfig } from "@/types.ts";
import { applyDefaults } from "../config/loader.ts";
import { DEFAULT_CONFIG } from "../constants/config.ts";
import {
	ensureGlobalRalphDirExists,
	ensureRalphDirExists,
	GLOBAL_CONFIG_PATH,
	PROJECT_CONFIG_PATH,
} from "../paths.ts";
import { isPartialRalphConfig } from "../type-guards.ts";

class ConfigServiceImpl {
	private cachedConfig: RalphConfig | null = null;
	private cachedGlobalConfig: RalphConfig | null = null;

	get(): RalphConfig {
		if (this.cachedConfig !== null) {
			return this.cachedConfig;
		}

		return this.load();
	}

	load(): RalphConfig {
		const globalConfig = this.loadGlobal();

		if (!existsSync(PROJECT_CONFIG_PATH)) {
			this.cachedConfig = globalConfig;

			return globalConfig;
		}

		try {
			const projectContent = readFileSync(PROJECT_CONFIG_PATH, "utf-8");
			const parsed: unknown = JSON.parse(projectContent);

			if (!isPartialRalphConfig(parsed)) {
				this.cachedConfig = globalConfig;

				return globalConfig;
			}

			this.cachedConfig = applyDefaults({ ...globalConfig, ...parsed });

			return this.cachedConfig;
		} catch {
			this.cachedConfig = globalConfig;

			return globalConfig;
		}
	}

	loadGlobal(): RalphConfig {
		if (this.cachedGlobalConfig !== null) {
			return this.cachedGlobalConfig;
		}

		if (!existsSync(GLOBAL_CONFIG_PATH)) {
			this.cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

			return this.cachedGlobalConfig;
		}

		try {
			const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isPartialRalphConfig(parsed)) {
				this.cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

				return this.cachedGlobalConfig;
			}

			this.cachedGlobalConfig = applyDefaults({ ...DEFAULT_CONFIG, ...parsed });

			return this.cachedGlobalConfig;
		} catch {
			this.cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

			return this.cachedGlobalConfig;
		}
	}

	loadGlobalRaw(): Partial<RalphConfig> | null {
		if (!existsSync(GLOBAL_CONFIG_PATH)) {
			return null;
		}

		try {
			const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isPartialRalphConfig(parsed)) {
				return null;
			}

			return parsed;
		} catch {
			return null;
		}
	}

	loadProjectRaw(): Partial<RalphConfig> | null {
		if (!existsSync(PROJECT_CONFIG_PATH)) {
			return null;
		}

		try {
			const content = readFileSync(PROJECT_CONFIG_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isPartialRalphConfig(parsed)) {
				return null;
			}

			return parsed;
		} catch {
			return null;
		}
	}

	getWithValidation(validateFn: (config: unknown) => ConfigValidationResult): {
		config: RalphConfig;
		validation: ConfigValidationResult;
	} {
		const config = this.get();
		const validation = validateFn(config);

		return { config, validation };
	}

	saveGlobal(config: RalphConfig): void {
		ensureGlobalRalphDirExists();
		writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
		this.invalidateGlobal();
	}

	saveProject(config: RalphConfig): void {
		ensureRalphDirExists();
		writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(config, null, 2));
		this.invalidate();
	}

	invalidate(): void {
		this.cachedConfig = null;
	}

	invalidateGlobal(): void {
		this.cachedGlobalConfig = null;
		this.cachedConfig = null;
	}

	invalidateAll(): void {
		this.cachedConfig = null;
		this.cachedGlobalConfig = null;
	}

	globalConfigExists(): boolean {
		return existsSync(GLOBAL_CONFIG_PATH);
	}

	getEffective(): {
		global: Partial<RalphConfig> | null;
		project: Partial<RalphConfig> | null;
		effective: RalphConfig;
	} {
		return {
			global: this.loadGlobalRaw(),
			project: this.loadProjectRaw(),
			effective: this.get(),
		};
	}
}

export const ConfigService = new ConfigServiceImpl();
