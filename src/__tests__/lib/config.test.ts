import { describe, expect, test } from "bun:test";
import {
	applyDefaults,
	CONFIG_DEFAULTS,
	formatValidationErrors,
	getConfigSummary,
	validateConfig,
} from "@/lib/config.ts";
import type { RalphConfig } from "@/types.ts";

describe("validateConfig", () => {
	test("returns error when config is null", () => {
		const result = validateConfig(null);

		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.field).toBe("config");
	});

	test("returns error when config is undefined", () => {
		const result = validateConfig(undefined);

		expect(result.valid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.field).toBe("config");
	});

	test("returns error when config is not an object", () => {
		const result = validateConfig("invalid");

		expect(result.valid).toBe(false);
		expect(result.errors[0]?.message).toBe("Configuration must be an object");
	});

	test("returns error when agent is missing", () => {
		const result = validateConfig({});

		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.field === "agent")).toBe(true);
	});

	test("returns error when agent is invalid", () => {
		const result = validateConfig({ agent: "invalid-agent" });

		expect(result.valid).toBe(false);
		expect(result.errors.some((error) => error.field === "agent")).toBe(true);
	});

	test("validates valid cursor agent config", () => {
		const result = validateConfig({ agent: "cursor" });

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("validates valid claude agent config", () => {
		const result = validateConfig({ agent: "claude" });

		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	test("validates prdFormat field", () => {
		const validJson = validateConfig({ agent: "cursor", prdFormat: "json" });

		expect(validJson.valid).toBe(true);

		const validYaml = validateConfig({ agent: "cursor", prdFormat: "yaml" });

		expect(validYaml.valid).toBe(true);

		const invalid = validateConfig({ agent: "cursor", prdFormat: "xml" });

		expect(invalid.valid).toBe(false);
		expect(invalid.errors.some((error) => error.field === "prdFormat")).toBe(true);
	});

	test("validates maxRetries as non-negative integer", () => {
		const validZero = validateConfig({ agent: "cursor", maxRetries: 0 });

		expect(validZero.valid).toBe(true);

		const validPositive = validateConfig({ agent: "cursor", maxRetries: 5 });

		expect(validPositive.valid).toBe(true);

		const invalidNegative = validateConfig({ agent: "cursor", maxRetries: -1 });

		expect(invalidNegative.valid).toBe(false);

		const invalidFloat = validateConfig({ agent: "cursor", maxRetries: 3.5 });

		expect(invalidFloat.valid).toBe(false);

		const invalidString = validateConfig({ agent: "cursor", maxRetries: "3" });

		expect(invalidString.valid).toBe(false);
	});

	test("validates retryDelayMs as positive integer", () => {
		const valid = validateConfig({ agent: "cursor", retryDelayMs: 5000 });

		expect(valid.valid).toBe(true);

		const invalidZero = validateConfig({ agent: "cursor", retryDelayMs: 0 });

		expect(invalidZero.valid).toBe(false);

		const invalidNegative = validateConfig({ agent: "cursor", retryDelayMs: -1000 });

		expect(invalidNegative.valid).toBe(false);
	});

	test("validates agentTimeoutMs allows zero (disabled)", () => {
		const validZero = validateConfig({ agent: "cursor", agentTimeoutMs: 0 });

		expect(validZero.valid).toBe(true);

		const validPositive = validateConfig({ agent: "cursor", agentTimeoutMs: 60000 });

		expect(validPositive.valid).toBe(true);
	});

	test("validates notifications config", () => {
		const validNotifications = validateConfig({
			agent: "cursor",
			notifications: {
				systemNotification: true,
				webhookUrl: "https://example.com/webhook",
			},
		});

		expect(validNotifications.valid).toBe(true);

		const invalidWebhookUrl = validateConfig({
			agent: "cursor",
			notifications: {
				webhookUrl: "not-a-url",
			},
		});

		expect(invalidWebhookUrl.valid).toBe(false);

		const invalidProtocol = validateConfig({
			agent: "cursor",
			notifications: {
				webhookUrl: "ftp://example.com",
			},
		});

		expect(invalidProtocol.valid).toBe(false);
	});

	test("validates memory config", () => {
		const validMemory = validateConfig({
			agent: "cursor",
			memory: {
				maxOutputBufferBytes: 1048576,
				memoryWarningThresholdMb: 500,
				enableGarbageCollectionHints: true,
			},
		});

		expect(validMemory.valid).toBe(true);

		const invalidBuffer = validateConfig({
			agent: "cursor",
			memory: {
				maxOutputBufferBytes: -100,
			},
		});

		expect(invalidBuffer.valid).toBe(false);
	});

	test("adds warning when stuckThresholdMs >= agentTimeoutMs", () => {
		const result = validateConfig({
			agent: "cursor",
			stuckThresholdMs: 60000,
			agentTimeoutMs: 30000,
		});

		expect(result.valid).toBe(true);
		expect(result.warnings.some((warning) => warning.field === "stuckThresholdMs")).toBe(true);
	});

	test("adds warning when maxRetries is very high", () => {
		const result = validateConfig({
			agent: "cursor",
			maxRetries: 15,
		});

		expect(result.valid).toBe(true);
		expect(result.warnings.some((warning) => warning.field === "maxRetries")).toBe(true);
	});

	test("adds warning when retryDelayMs is very low", () => {
		const result = validateConfig({
			agent: "cursor",
			retryDelayMs: 500,
		});

		expect(result.valid).toBe(true);
		expect(result.warnings.some((warning) => warning.field === "retryDelayMs")).toBe(true);
	});

	test("adds warning when agentTimeoutMs is less than 1 minute", () => {
		const result = validateConfig({
			agent: "cursor",
			agentTimeoutMs: 30000,
		});

		expect(result.valid).toBe(true);
		expect(result.warnings.some((warning) => warning.field === "agentTimeoutMs")).toBe(true);
	});
});

describe("applyDefaults", () => {
	test("applies all defaults to empty config", () => {
		const result = applyDefaults({});

		expect(result.agent).toBe(CONFIG_DEFAULTS.agent);
		expect(result.prdFormat).toBe(CONFIG_DEFAULTS.prdFormat);
		expect(result.maxRetries).toBe(CONFIG_DEFAULTS.maxRetries);
		expect(result.retryDelayMs).toBe(CONFIG_DEFAULTS.retryDelayMs);
		expect(result.logFilePath).toBe(CONFIG_DEFAULTS.logFilePath);
		expect(result.agentTimeoutMs).toBe(CONFIG_DEFAULTS.agentTimeoutMs);
		expect(result.stuckThresholdMs).toBe(CONFIG_DEFAULTS.stuckThresholdMs);
	});

	test("preserves provided values", () => {
		const result = applyDefaults({
			agent: "claude",
			maxRetries: 10,
		});

		expect(result.agent).toBe("claude");
		expect(result.maxRetries).toBe(10);
		expect(result.prdFormat).toBe(CONFIG_DEFAULTS.prdFormat);
	});

	test("merges notifications config with defaults", () => {
		const result = applyDefaults({
			notifications: {
				systemNotification: true,
			},
		});

		expect(result.notifications?.systemNotification).toBe(true);
		expect(result.notifications?.webhookUrl).toBeUndefined();
	});

	test("merges memory config with defaults", () => {
		const result = applyDefaults({
			memory: {
				maxOutputBufferBytes: 2000000,
			},
		});

		expect(result.memory?.maxOutputBufferBytes).toBe(2000000);
	});

	test("preserves optional fields when provided", () => {
		const result = applyDefaults({
			lastUpdateCheck: 1234567890,
			skipVersion: "1.0.0",
		});

		expect(result.lastUpdateCheck).toBe(1234567890);
		expect(result.skipVersion).toBe("1.0.0");
	});
});

describe("formatValidationErrors", () => {
	test("formats errors correctly", () => {
		const result = formatValidationErrors({
			valid: false,
			errors: [
				{ field: "agent", message: "is required" },
				{ field: "maxRetries", message: "must be a number", value: "invalid" },
			],
			warnings: [],
		});

		expect(result).toContain("Configuration validation failed");
		expect(result).toContain("agent: is required");
		expect(result).toContain('maxRetries: must be a number (got: "invalid")');
	});

	test("formats warnings correctly", () => {
		const result = formatValidationErrors({
			valid: true,
			errors: [],
			warnings: [{ field: "maxRetries", message: "is very high", value: 15 }],
		});

		expect(result).toContain("Configuration warnings");
		expect(result).toContain("maxRetries: is very high");
	});

	test("includes hints in verbose mode", () => {
		const result = formatValidationErrors(
			{
				valid: false,
				errors: [{ field: "agent", message: "is required" }],
				warnings: [],
			},
			true,
		);

		expect(result).toContain("Hint:");
	});

	test("returns empty string for valid config with no warnings", () => {
		const result = formatValidationErrors({
			valid: true,
			errors: [],
			warnings: [],
		});

		expect(result).toBe("");
	});
});

describe("getConfigSummary", () => {
	test("generates summary for minimal config", () => {
		const config: RalphConfig = {
			agent: "cursor",
		};
		const summary = getConfigSummary(config);

		expect(summary).toContain("Agent Settings:");
		expect(summary).toContain("cursor");
		expect(summary).toContain("Retry Settings:");
		expect(summary).toContain("Timeout Settings:");
		expect(summary).toContain("Logging:");
		expect(summary).toContain("Notifications:");
		expect(summary).toContain("Memory Management:");
	});

	test("shows disabled timeouts correctly", () => {
		const config: RalphConfig = {
			agent: "cursor",
			agentTimeoutMs: 0,
			stuckThresholdMs: 0,
		};
		const summary = getConfigSummary(config);

		expect(summary).toContain("Agent Timeout:      disabled");
		expect(summary).toContain("Stuck Threshold:    disabled");
	});

	test("formats time values correctly", () => {
		const config: RalphConfig = {
			agent: "cursor",
			agentTimeoutMs: 600000,
			retryDelayMs: 5000,
		};
		const summary = getConfigSummary(config);

		expect(summary).toContain("10m");
		expect(summary).toContain("5s");
	});
});
