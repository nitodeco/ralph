import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "../../idempotency.ts";
import {
  GLOBAL_CONFIG_PATH,
  ensureGlobalRalphDirExists,
  ensureProjectDirExists,
  getProjectConfigPath,
} from "../../paths.ts";
import { AGENT_COMMANDS, CONFIG_DEFAULTS, DEFAULT_CONFIG } from "./constants.ts";
import type { AgentType, ConfigService, ConfigValidationResult, RalphConfig } from "./types.ts";
import { isPartialRalphConfig } from "./validation.ts";

export function applyDefaults(config: Partial<RalphConfig>): RalphConfig {
  const defaults = CONFIG_DEFAULTS;

  return {
    agent: config.agent ?? defaults.agent,
    agentTimeoutMs: config.agentTimeoutMs ?? defaults.agentTimeoutMs,
    branchMode: config.branchMode,
    gitProvider: config.gitProvider,
    hasAcknowledgedWarning: config.hasAcknowledgedWarning,
    lastUpdateCheck: config.lastUpdateCheck,
    learningEnabled: config.learningEnabled ?? defaults.learningEnabled,
    logFilePath: config.logFilePath,
    maxDecompositionsPerTask: config.maxDecompositionsPerTask ?? defaults.maxDecompositionsPerTask,
    maxOutputHistoryBytes: config.maxOutputHistoryBytes ?? defaults.maxOutputHistoryBytes,
    maxRetries: config.maxRetries ?? defaults.maxRetries,
    maxRuntimeMs: config.maxRuntimeMs,
    memory: config.memory ? { ...defaults.memory, ...config.memory } : defaults.memory,
    notifications: config.notifications
      ? { ...defaults.notifications, ...config.notifications }
      : defaults.notifications,
    retryDelayMs: config.retryDelayMs ?? defaults.retryDelayMs,
    retryWithContext: config.retryWithContext ?? defaults.retryWithContext,
    skipVersion: config.skipVersion,
    stuckThresholdMs: config.stuckThresholdMs ?? defaults.stuckThresholdMs,
    technicalDebtReview: config.technicalDebtReview,
    verification: config.verification
      ? { ...defaults.verification, ...config.verification }
      : defaults.verification,
    workflowMode: config.workflowMode,
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
      const content = readFileSync(GLOBAL_CONFIG_PATH, "utf8");
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
      const projectContent = readFileSync(projectConfigPath, "utf8");
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
    acknowledgeWarning(): void {
      const config = this.loadGlobal();

      this.saveGlobal({ ...config, hasAcknowledgedWarning: true });
    },

    get(): RalphConfig {
      if (cachedConfig !== null) {
        return cachedConfig;
      }

      return loadConfig();
    },

    getEffective(): {
      global: Partial<RalphConfig> | null;
      project: Partial<RalphConfig> | null;
      effective: RalphConfig;
    } {
      return {
        effective: this.get(),
        global: this.loadGlobalRaw(),
        project: this.loadProjectRaw(),
      };
    },

    getWithValidation(validateFn: (config: unknown) => ConfigValidationResult): {
      config: RalphConfig;
      validation: ConfigValidationResult;
    } {
      const config = this.get();
      const validation = validateFn(config);

      return { config, validation };
    },

    globalConfigExists(): boolean {
      return existsSync(GLOBAL_CONFIG_PATH);
    },

    hasAcknowledgedWarning(): boolean {
      const rawConfig = this.loadGlobalRaw();

      return rawConfig?.hasAcknowledgedWarning === true;
    },

    invalidate(): void {
      cachedConfig = null;
    },

    invalidateAll(): void {
      cachedConfig = null;
      cachedGlobalConfig = null;
    },

    invalidateGlobal(): void {
      cachedGlobalConfig = null;
      cachedConfig = null;
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
        const content = readFileSync(GLOBAL_CONFIG_PATH, "utf8");
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
        const content = readFileSync(projectConfigPath, "utf8");
        const parsed: unknown = JSON.parse(content);

        if (!isPartialRalphConfig(parsed)) {
          return null;
        }

        return parsed;
      } catch {
        return null;
      }
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
  };
}
