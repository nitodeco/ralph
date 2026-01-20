import type {
	ConfigValidationError,
	ConfigValidationResult,
	MemoryConfig,
	NotificationConfig,
	RalphConfig,
} from "@/types.ts";
import { VALID_AGENTS, VALID_PRD_FORMATS } from "./constants.ts";

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
	validatePositiveInteger(ralphConfig.maxRuntimeMs, "maxRuntimeMs", errors);
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
