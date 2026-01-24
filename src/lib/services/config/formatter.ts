import { GLOBAL_CONFIG_PATH, getProjectConfigPath } from "../../paths.ts";
import { CONFIG_DEFAULTS } from "./constants.ts";
import type { ConfigValidationResult, RalphConfig } from "./types.ts";

const FIELD_SUGGESTIONS: Record<string, string> = {
	agent: "Valid options: 'cursor' or 'claude'. Example: \"agent\": \"claude\"",
	maxRetries: 'Must be a non-negative integer. Recommended: 3-5. Example: "maxRetries": 3',
	retryDelayMs:
		'Must be a positive integer in milliseconds. Recommended: 5000-10000. Example: "retryDelayMs": 5000',
	agentTimeoutMs:
		'Must be a non-negative integer in milliseconds. Set to 0 to disable. Recommended: 600000 (10 min). Example: "agentTimeoutMs": 600000',
	stuckThresholdMs:
		'Must be a non-negative integer in milliseconds. Set to 0 to disable. Recommended: 180000 (3 min). Example: "stuckThresholdMs": 180000',
	logFilePath: "Optional. Custom log file path. Defaults to project directory in ~/.ralph/",
	"notifications.webhookUrl":
		'Must be a valid HTTP or HTTPS URL. Example: "webhookUrl": "https://hooks.slack.com/..."',
	"memory.maxOutputBufferBytes":
		'Must be a positive integer. Recommended: 1048576 (1MB). Example: "maxOutputBufferBytes": 1048576',
};

export function formatValidationErrors(result: ConfigValidationResult, verbose = false): string {
	const lines: string[] = [];

	if (result.errors.length > 0) {
		lines.push("Configuration validation failed:");
		lines.push("");

		for (const error of result.errors) {
			const valueInfo = error.value !== undefined ? ` (got: ${JSON.stringify(error.value)})` : "";

			lines.push(`  ✗ ${error.field}: ${error.message}${valueInfo}`);

			if (verbose) {
				const suggestion = FIELD_SUGGESTIONS[error.field];

				if (suggestion) {
					lines.push(`    Hint: ${suggestion}`);
				}
			}
		}

		lines.push("");
		lines.push("To fix: Edit your config file or run 'ralph setup' to reconfigure.");
		lines.push("Config locations:");
		lines.push(`  Global: ${GLOBAL_CONFIG_PATH}`);
		lines.push(`  Project: ${getProjectConfigPath()}`);
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

			if (verbose) {
				const suggestion = FIELD_SUGGESTIONS[warning.field];

				if (suggestion) {
					lines.push(`    Hint: ${suggestion}`);
				}
			}
		}
	}

	return lines.join("\n");
}

export function formatMs(milliseconds: number): string {
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

export function formatBytes(bytes: number): string {
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

export function getConfigSummary(config: RalphConfig): string {
	const lines: string[] = [];

	lines.push("Agent Settings:");
	lines.push(`  Agent:              ${config.agent}`);
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
	lines.push(
		`  Log File:           ${config.logFilePath ?? "(auto-resolved to project directory)"}`,
	);
	lines.push("");

	lines.push("Notifications:");
	const notifications = config.notifications ?? CONFIG_DEFAULTS.notifications;

	lines.push(`  System Notify:      ${notifications.systemNotification ? "enabled" : "disabled"}`);
	lines.push(`  Webhook URL:        ${notifications.webhookUrl ?? "not set"}`);
	lines.push(`  Marker File:        ${notifications.markerFilePath ?? "not set"}`);
	lines.push("");

	lines.push("Memory Management:");
	const memory = config.memory ?? CONFIG_DEFAULTS.memory;
	const maxOutputBufferBytes =
		memory.maxOutputBufferBytes ?? CONFIG_DEFAULTS.memory.maxOutputBufferBytes ?? 0;

	lines.push(`  Output Buffer:      ${formatBytes(maxOutputBufferBytes)}`);
	lines.push(
		`  Memory Warning:     ${memory.memoryWarningThresholdMb === 0 ? "disabled" : `${memory.memoryWarningThresholdMb ?? CONFIG_DEFAULTS.memory.memoryWarningThresholdMb} MB`}`,
	);
	lines.push(
		`  GC Hints:           ${memory.enableGarbageCollectionHints !== false ? "enabled" : "disabled"}`,
	);

	return lines.join("\n");
}
