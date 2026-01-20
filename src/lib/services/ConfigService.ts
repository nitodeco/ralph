import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ConfigValidationResult, RalphConfig } from "@/types.ts";
import { DEFAULTS } from "../defaults.ts";
import {
	ensureGlobalRalphDirExists,
	ensureRalphDirExists,
	GLOBAL_CONFIG_PATH,
	PROJECT_CONFIG_PATH,
} from "../paths.ts";

const CONFIG_DEFAULTS: Required<Omit<RalphConfig, "lastUpdateCheck" | "skipVersion">> = {
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
	retryWithContext: DEFAULTS.retryWithContext,
};

const DEFAULT_CONFIG: RalphConfig = {
	agent: DEFAULTS.agent,
	prdFormat: DEFAULTS.prdFormat,
	maxRetries: DEFAULTS.maxRetries,
	retryDelayMs: DEFAULTS.retryDelayMs,
};

function applyDefaults(config: Partial<RalphConfig>): RalphConfig {
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
	};
}

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
			const projectConfig = JSON.parse(projectContent) as Partial<RalphConfig>;
			this.cachedConfig = applyDefaults({ ...globalConfig, ...projectConfig });
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
			const parsed = JSON.parse(content) as Partial<RalphConfig>;
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
			return JSON.parse(content) as Partial<RalphConfig>;
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
			return JSON.parse(content) as Partial<RalphConfig>;
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
