import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
	AgentType,
	MemoryConfig,
	NotificationConfig,
	PrdFormat,
	RalphConfig,
} from "@/types.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";

const GLOBAL_RALPH_DIR = join(homedir(), ".ralph");
const GLOBAL_CONFIG_PATH = join(GLOBAL_RALPH_DIR, "config.json");
const PROJECT_CONFIG_PATH = `${RALPH_DIR}/config.json`;

export const DEFAULT_AGENT_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_STUCK_THRESHOLD_MS = 5 * 60 * 1000;
export const DEFAULT_MAX_OUTPUT_BUFFER_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MEMORY_WARNING_THRESHOLD_MB = 500;
export const DEFAULT_ENABLE_GC_HINTS = true;

export const CONFIG_DEFAULTS: Required<Omit<RalphConfig, "lastUpdateCheck" | "skipVersion">> = {
	agent: "cursor",
	prdFormat: "json",
	maxRetries: 3,
	retryDelayMs: 5000,
	logFilePath: ".ralph/ralph.log",
	agentTimeoutMs: DEFAULT_AGENT_TIMEOUT_MS,
	stuckThresholdMs: DEFAULT_STUCK_THRESHOLD_MS,
	notifications: {
		systemNotification: false,
		webhookUrl: undefined,
		markerFilePath: undefined,
	},
	memory: {
		maxOutputBufferBytes: DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
		memoryWarningThresholdMb: DEFAULT_MEMORY_WARNING_THRESHOLD_MB,
		enableGarbageCollectionHints: true,
	},
	maxOutputHistoryBytes: DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
};

const DEFAULT_CONFIG: RalphConfig = {
	agent: "cursor",
	prdFormat: "json",
	maxRetries: 3,
	retryDelayMs: 5000,
};

const VALID_AGENTS: AgentType[] = ["cursor", "claude"];
const VALID_PRD_FORMATS: PrdFormat[] = ["json", "yaml"];

export interface ConfigValidationError {
	field: string;
	message: string;
	value?: unknown;
}

export interface ConfigValidationResult {
	valid: boolean;
	errors: ConfigValidationError[];
	warnings: ConfigValidationError[];
}

function validatePositiveInteger(
	value: unknown,
	fieldName: string,
	errors: ConfigValidationError[],
	allowZero = false,
): void {
	if (value === undefined || value === null) {
		return;
	}
	if (typeof value !== "number") {
		errors.push({
			field: fieldName,
			message: `must be a number`,
			value,
		});
		return;
	}
	if (!Number.isInteger(value)) {
		errors.push({
			field: fieldName,
			message: `must be an integer`,
			value,
		});
		return;
	}
	if (allowZero ? value < 0 : value <= 0) {
		errors.push({
			field: fieldName,
			message: allowZero ? `must be a non-negative integer` : `must be a positive integer`,
			value,
		});
	}
}

function validateString(
	value: unknown,
	fieldName: string,
	errors: ConfigValidationError[],
	allowedValues?: readonly string[],
): void {
	if (value === undefined || value === null) {
		return;
	}
	if (typeof value !== "string") {
		errors.push({
			field: fieldName,
			message: `must be a string`,
			value,
		});
		return;
	}
	if (allowedValues && !allowedValues.includes(value)) {
		errors.push({
			field: fieldName,
			message: `must be one of: ${allowedValues.join(", ")}`,
			value,
		});
	}
}

function validateBoolean(value: unknown, fieldName: string, errors: ConfigValidationError[]): void {
	if (value === undefined || value === null) {
		return;
	}
	if (typeof value !== "boolean") {
		errors.push({
			field: fieldName,
			message: `must be a boolean`,
			value,
		});
	}
}

function validateUrl(value: unknown, fieldName: string, errors: ConfigValidationError[]): void {
	if (value === undefined || value === null || value === "") {
		return;
	}
	if (typeof value !== "string") {
		errors.push({
			field: fieldName,
			message: `must be a string`,
			value,
		});
		return;
	}
	try {
		const url = new URL(value);
		if (!["http:", "https:"].includes(url.protocol)) {
			errors.push({
				field: fieldName,
				message: `must be a valid HTTP or HTTPS URL`,
				value,
			});
		}
	} catch {
		errors.push({
			field: fieldName,
			message: `must be a valid URL`,
			value,
		});
	}
}

function validateNotificationConfig(config: unknown, errors: ConfigValidationError[]): void {
	if (config === undefined || config === null) {
		return;
	}
	if (typeof config !== "object") {
		errors.push({
			field: "notifications",
			message: "must be an object",
			value: config,
		});
		return;
	}
	const notificationConfig = config as NotificationConfig;
	validateBoolean(
		notificationConfig.systemNotification,
		"notifications.systemNotification",
		errors,
	);
	validateUrl(notificationConfig.webhookUrl, "notifications.webhookUrl", errors);
	validateString(notificationConfig.markerFilePath, "notifications.markerFilePath", errors);
}

function validateMemoryConfig(config: unknown, errors: ConfigValidationError[]): void {
	if (config === undefined || config === null) {
		return;
	}
	if (typeof config !== "object") {
		errors.push({
			field: "memory",
			message: "must be an object",
			value: config,
		});
		return;
	}
	const memoryConfig = config as MemoryConfig;
	validatePositiveInteger(memoryConfig.maxOutputBufferBytes, "memory.maxOutputBufferBytes", errors);
	validatePositiveInteger(
		memoryConfig.memoryWarningThresholdMb,
		"memory.memoryWarningThresholdMb",
		errors,
		true,
	);
	validateBoolean(
		memoryConfig.enableGarbageCollectionHints,
		"memory.enableGarbageCollectionHints",
		errors,
	);
}

export function validateConfig(config: unknown): ConfigValidationResult {
	const errors: ConfigValidationError[] = [];
	const warnings: ConfigValidationError[] = [];

	if (config === undefined || config === null) {
		return {
			valid: false,
			errors: [{ field: "config", message: "Configuration is required" }],
			warnings: [],
		};
	}

	if (typeof config !== "object") {
		return {
			valid: false,
			errors: [{ field: "config", message: "Configuration must be an object", value: config }],
			warnings: [],
		};
	}

	const ralphConfig = config as RalphConfig;

	if (ralphConfig.agent === undefined) {
		errors.push({
			field: "agent",
			message: "is required. Choose either 'cursor' or 'claude'",
		});
	} else {
		validateString(ralphConfig.agent, "agent", errors, VALID_AGENTS);
	}

	validateString(ralphConfig.prdFormat, "prdFormat", errors, VALID_PRD_FORMATS);
	validatePositiveInteger(ralphConfig.maxRetries, "maxRetries", errors, true);
	validatePositiveInteger(ralphConfig.retryDelayMs, "retryDelayMs", errors);
	validateString(ralphConfig.logFilePath, "logFilePath", errors);
	validatePositiveInteger(ralphConfig.agentTimeoutMs, "agentTimeoutMs", errors, true);
	validatePositiveInteger(ralphConfig.stuckThresholdMs, "stuckThresholdMs", errors, true);
	validatePositiveInteger(ralphConfig.lastUpdateCheck, "lastUpdateCheck", errors, true);
	validateString(ralphConfig.skipVersion, "skipVersion", errors);
	validatePositiveInteger(ralphConfig.maxOutputHistoryBytes, "maxOutputHistoryBytes", errors);
	validateNotificationConfig(ralphConfig.notifications, errors);
	validateMemoryConfig(ralphConfig.memory, errors);

	if (
		ralphConfig.stuckThresholdMs !== undefined &&
		ralphConfig.agentTimeoutMs !== undefined &&
		typeof ralphConfig.stuckThresholdMs === "number" &&
		typeof ralphConfig.agentTimeoutMs === "number" &&
		ralphConfig.stuckThresholdMs > 0 &&
		ralphConfig.agentTimeoutMs > 0 &&
		ralphConfig.stuckThresholdMs >= ralphConfig.agentTimeoutMs
	) {
		warnings.push({
			field: "stuckThresholdMs",
			message: "is greater than or equal to agentTimeoutMs - stuck detection will never trigger",
			value: {
				stuckThresholdMs: ralphConfig.stuckThresholdMs,
				agentTimeoutMs: ralphConfig.agentTimeoutMs,
			},
		});
	}

	if (
		ralphConfig.maxRetries !== undefined &&
		typeof ralphConfig.maxRetries === "number" &&
		ralphConfig.maxRetries > 10
	) {
		warnings.push({
			field: "maxRetries",
			message: "is very high (>10) - this may lead to long recovery times for persistent failures",
			value: ralphConfig.maxRetries,
		});
	}

	if (
		ralphConfig.retryDelayMs !== undefined &&
		typeof ralphConfig.retryDelayMs === "number" &&
		ralphConfig.retryDelayMs < 1000
	) {
		warnings.push({
			field: "retryDelayMs",
			message: "is very low (<1s) - rapid retries may overwhelm the system",
			value: ralphConfig.retryDelayMs,
		});
	}

	if (
		ralphConfig.agentTimeoutMs !== undefined &&
		typeof ralphConfig.agentTimeoutMs === "number" &&
		ralphConfig.agentTimeoutMs > 0 &&
		ralphConfig.agentTimeoutMs < 60000
	) {
		warnings.push({
			field: "agentTimeoutMs",
			message: "is less than 1 minute - agents may timeout before completing complex tasks",
			value: ralphConfig.agentTimeoutMs,
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

export function formatValidationErrors(result: ConfigValidationResult): string {
	const lines: string[] = [];

	if (result.errors.length > 0) {
		lines.push("Configuration validation failed:");
		lines.push("");
		for (const error of result.errors) {
			const valueInfo = error.value !== undefined ? ` (got: ${JSON.stringify(error.value)})` : "";
			lines.push(`  ✗ ${error.field}: ${error.message}${valueInfo}`);
		}
		lines.push("");
		lines.push("Fix these issues in your config file or run 'ralph setup' to reconfigure.");
	}

	if (result.warnings.length > 0) {
		if (lines.length > 0) {
			lines.push("");
		}
		lines.push("Configuration warnings:");
		lines.push("");
		for (const warning of result.warnings) {
			const valueInfo =
				warning.value !== undefined ? ` (current: ${JSON.stringify(warning.value)})` : "";
			lines.push(`  ⚠ ${warning.field}: ${warning.message}${valueInfo}`);
		}
	}

	return lines.join("\n");
}

export function getConfigSummary(config: RalphConfig): string {
	const lines: string[] = [];

	lines.push("Agent Settings:");
	lines.push(`  Agent:              ${config.agent}`);
	lines.push(`  PRD Format:         ${config.prdFormat ?? "json"}`);
	lines.push("");

	lines.push("Retry Settings:");
	lines.push(`  Max Retries:        ${config.maxRetries ?? CONFIG_DEFAULTS.maxRetries}`);
	lines.push(
		`  Retry Delay:        ${formatMs(config.retryDelayMs ?? CONFIG_DEFAULTS.retryDelayMs)}`,
	);
	lines.push("");

	lines.push("Timeout Settings:");
	lines.push(
		`  Agent Timeout:      ${config.agentTimeoutMs === 0 ? "disabled" : formatMs(config.agentTimeoutMs ?? CONFIG_DEFAULTS.agentTimeoutMs)}`,
	);
	lines.push(
		`  Stuck Threshold:    ${config.stuckThresholdMs === 0 ? "disabled" : formatMs(config.stuckThresholdMs ?? CONFIG_DEFAULTS.stuckThresholdMs)}`,
	);
	lines.push("");

	lines.push("Logging:");
	lines.push(`  Log File:           ${config.logFilePath ?? CONFIG_DEFAULTS.logFilePath}`);
	lines.push("");

	lines.push("Notifications:");
	const notifications = config.notifications ?? CONFIG_DEFAULTS.notifications;
	lines.push(`  System Notify:      ${notifications.systemNotification ? "enabled" : "disabled"}`);
	lines.push(`  Webhook URL:        ${notifications.webhookUrl ?? "not set"}`);
	lines.push(`  Marker File:        ${notifications.markerFilePath ?? "not set"}`);
	lines.push("");

	lines.push("Memory Management:");
	const memory = config.memory ?? CONFIG_DEFAULTS.memory;
	lines.push(
		`  Output Buffer:      ${formatBytes(memory.maxOutputBufferBytes ?? CONFIG_DEFAULTS.memory.maxOutputBufferBytes)}`,
	);
	lines.push(
		`  Memory Warning:     ${memory.memoryWarningThresholdMb === 0 ? "disabled" : `${memory.memoryWarningThresholdMb ?? CONFIG_DEFAULTS.memory.memoryWarningThresholdMb} MB`}`,
	);
	lines.push(
		`  GC Hints:           ${memory.enableGarbageCollectionHints !== false ? "enabled" : "disabled"}`,
	);

	return lines.join("\n");
}

function formatMs(milliseconds: number): string {
	if (milliseconds >= 60000) {
		const minutes = Math.floor(milliseconds / 60000);
		const seconds = Math.floor((milliseconds % 60000) / 1000);
		return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
	}
	if (milliseconds >= 1000) {
		return `${milliseconds / 1000}s`;
	}
	return `${milliseconds}ms`;
}

function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${bytes} B`;
}

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

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
	cursor: ["agent", "-p", "--force", "--output-format", "stream-json", "--stream-partial-output"],
	claude: ["claude", "-p", "--dangerously-skip-permissions"],
};

function ensureGlobalRalphDirExists(): void {
	if (!existsSync(GLOBAL_RALPH_DIR)) {
		mkdirSync(GLOBAL_RALPH_DIR, { recursive: true });
	}
}

export function loadGlobalConfig(): RalphConfig {
	if (!existsSync(GLOBAL_CONFIG_PATH)) {
		return applyDefaults(DEFAULT_CONFIG);
	}

	try {
		const content = readFileSync(GLOBAL_CONFIG_PATH, "utf-8");
		const parsed = JSON.parse(content) as Partial<RalphConfig>;
		return applyDefaults({ ...DEFAULT_CONFIG, ...parsed });
	} catch {
		return applyDefaults(DEFAULT_CONFIG);
	}
}

export function loadGlobalConfigRaw(): Partial<RalphConfig> | null {
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

export function saveGlobalConfig(config: RalphConfig): void {
	ensureGlobalRalphDirExists();
	writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function globalConfigExists(): boolean {
	return existsSync(GLOBAL_CONFIG_PATH);
}

export function loadConfig(): RalphConfig {
	const globalConfig = loadGlobalConfig();

	if (!existsSync(PROJECT_CONFIG_PATH)) {
		return globalConfig;
	}

	try {
		const projectContent = readFileSync(PROJECT_CONFIG_PATH, "utf-8");
		const projectConfig = JSON.parse(projectContent) as Partial<RalphConfig>;
		return applyDefaults({ ...globalConfig, ...projectConfig });
	} catch {
		return globalConfig;
	}
}

export function loadProjectConfigRaw(): Partial<RalphConfig> | null {
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

export function loadConfigWithValidation(): {
	config: RalphConfig;
	validation: ConfigValidationResult;
} {
	const config = loadConfig();
	const validation = validateConfig(config);
	return { config, validation };
}

export function saveConfig(config: RalphConfig): void {
	ensureRalphDirExists();
	writeFileSync(PROJECT_CONFIG_PATH, JSON.stringify(config, null, 2));
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
	return {
		global: loadGlobalConfigRaw(),
		project: loadProjectConfigRaw(),
		effective: loadConfig(),
	};
}
