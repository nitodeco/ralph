import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "../../idempotency.ts";
import {
	ensureGlobalRalphDirExists,
	ensureProjectDirExists,
	GLOBAL_CONFIG_PATH,
	getProjectConfigPath,
} from "../../paths.ts";
import { AGENT_COMMANDS, CONFIG_DEFAULTS, DEFAULT_CONFIG } from "./constants.ts";
import type { AgentType, ConfigService, ConfigValidationResult, RalphConfig } from "./types.ts";
import { isPartialRalphConfig } from "./validation.ts";

export function applyDefaults(config: Partial<RalphConfig>): RalphConfig {
	const defaults = CONFIG_DEFAULTS;

	return {
		agent: config.agent ?? defaults.agent,
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
		maxRuntimeMs: config.maxRuntimeMs,
		retryWithContext: config.retryWithContext ?? defaults.retryWithContext,
		verification: config.verification
			? { ...defaults.verification, ...config.verification }
			: defaults.verification,
		technicalDebtReview: config.technicalDebtReview,
		maxDecompositionsPerTask: config.maxDecompositionsPerTask ?? defaults.maxDecompositionsPerTask,
		learningEnabled: config.learningEnabled ?? defaults.learningEnabled,
		workflowMode: config.workflowMode,
		branchMode: config.branchMode,
		gitProvider: config.gitProvider,
		hasAcknowledgedWarning: config.hasAcknowledgedWarning,
	};
}

export function getAgentCommand(agentType: AgentType): string[] {
	return AGENT_COMMANDS[agentType];
}

export function getGlobalConfigPath(): string {
	return GLOBAL_CONFIG_PATH;
}

export function createConfigService(): ConfigService {
	let cachedConfig: RalphConfig | null = null;
	let cachedGlobalConfig: RalphConfig | null = null;

	function loadGlobalConfig(): RalphConfig {
		if (cachedGlobalConfig !== null) {
			return cachedGlobalConfig;
		}

		if (!existsSync(GLOBAL_CONFIG_PATH)) {
			cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

			return cachedGlobalConfig;
		}

		try {
			const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isPartialRalphConfig(parsed)) {
				cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

				return cachedGlobalConfig;
			}

			cachedGlobalConfig = applyDefaults({ ...DEFAULT_CONFIG, ...parsed });

			return cachedGlobalConfig;
		} catch {
			cachedGlobalConfig = applyDefaults(DEFAULT_CONFIG);

			return cachedGlobalConfig;
		}
	}

	function loadConfig(): RalphConfig {
		const globalConfig = loadGlobalConfig();
		const projectConfigPath = getProjectConfigPath();

		if (!existsSync(projectConfigPath)) {
			cachedConfig = globalConfig;

			return globalConfig;
		}

		try {
			const projectContent = readFileSync(projectConfigPath, "utf-8");
			const parsed: unknown = JSON.parse(projectContent);

			if (!isPartialRalphConfig(parsed)) {
				cachedConfig = globalConfig;

				return globalConfig;
			}

			cachedConfig = applyDefaults({ ...globalConfig, ...parsed });

			return cachedConfig;
		} catch {
			cachedConfig = globalConfig;

			return globalConfig;
		}
	}

	return {
		get(): RalphConfig {
			if (cachedConfig !== null) {
				return cachedConfig;
			}

			return loadConfig();
		},

		load(): RalphConfig {
			return loadConfig();
		},

		loadGlobal(): RalphConfig {
			return loadGlobalConfig();
		},

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
		},

		loadProjectRaw(): Partial<RalphConfig> | null {
			const projectConfigPath = getProjectConfigPath();

			if (!existsSync(projectConfigPath)) {
				return null;
			}

			try {
				const content = readFileSync(projectConfigPath, "utf-8");
				const parsed: unknown = JSON.parse(content);

				if (!isPartialRalphConfig(parsed)) {
					return null;
				}

				return parsed;
			} catch {
				return null;
			}
		},

		getWithValidation(validateFn: (config: unknown) => ConfigValidationResult): {
			config: RalphConfig;
			validation: ConfigValidationResult;
		} {
			const config = this.get();
			const validation = validateFn(config);

			return { config, validation };
		},

		saveGlobal(config: RalphConfig): void {
			ensureGlobalRalphDirExists();
			writeFileIdempotent(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
			cachedGlobalConfig = null;
			cachedConfig = null;
		},

		saveProject(config: RalphConfig): void {
			ensureProjectDirExists();
			writeFileIdempotent(getProjectConfigPath(), JSON.stringify(config, null, 2));
			cachedConfig = null;
		},

		invalidate(): void {
			cachedConfig = null;
		},

		invalidateGlobal(): void {
			cachedGlobalConfig = null;
			cachedConfig = null;
		},

		invalidateAll(): void {
			cachedConfig = null;
			cachedGlobalConfig = null;
		},

		globalConfigExists(): boolean {
			return existsSync(GLOBAL_CONFIG_PATH);
		},

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
		},
	};
}
