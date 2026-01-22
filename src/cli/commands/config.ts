import {
	CONFIG_DEFAULTS,
	formatValidationErrors,
	getEffectiveConfig,
	getGlobalConfigPath,
	getProjectConfigPath,
	validateConfig,
} from "@/lib/config.ts";
import { CLI_SEPARATOR_WIDTH } from "@/lib/constants/ui.ts";
import type { ConfigOutput } from "@/types.ts";
import { formatBytes, formatDuration } from "../formatters.ts";

export function printConfig(version: string, jsonOutput: boolean, verbose = false): void {
	const { global: globalConfig, project: projectConfig, effective } = getEffectiveConfig();
	const validation = validateConfig(effective);

	if (jsonOutput) {
		const output: ConfigOutput = {
			global: {
				path: getGlobalConfigPath(),
				exists: globalConfig !== null,
				values: globalConfig,
			},
			project: {
				path: getProjectConfigPath(),
				exists: projectConfig !== null,
				values: projectConfig,
			},
			effective: effective as unknown as Record<string, unknown>,
			validation: {
				valid: validation.valid,
				errors: validation.errors,
				warnings: validation.warnings,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - Configuration\n`);

	console.log("Config Files:");
	console.log(`  Global:  ${getGlobalConfigPath()} ${globalConfig ? "(exists)" : "(not found)"}`);
	console.log(`  Project: ${getProjectConfigPath()} ${projectConfig ? "(exists)" : "(not found)"}`);

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);
	console.log("\nEffective Configuration:\n");

	console.log("  Agent Settings:");
	console.log(`    agent:            ${effective.agent}`);

	console.log("\n  Retry Settings:");
	console.log(`    maxRetries:       ${effective.maxRetries}`);
	console.log(
		`    retryDelayMs:     ${effective.retryDelayMs} (${formatDuration(effective.retryDelayMs ?? 0)})`,
	);

	console.log("\n  Timeout Settings:");
	console.log(
		`    agentTimeoutMs:   ${effective.agentTimeoutMs} (${formatDuration(effective.agentTimeoutMs ?? 0)})`,
	);
	console.log(
		`    stuckThresholdMs: ${effective.stuckThresholdMs} (${formatDuration(effective.stuckThresholdMs ?? 0)})`,
	);

	console.log("\n  Logging:");
	console.log(`    logFilePath:      ${effective.logFilePath}`);

	console.log("\n  Notifications:");

	if (effective.notifications) {
		console.log(
			`    systemNotification: ${effective.notifications.systemNotification ? "enabled" : "disabled"}`,
		);
		console.log(`    webhookUrl:         ${effective.notifications.webhookUrl ?? "(not set)"}`);
		console.log(`    markerFilePath:     ${effective.notifications.markerFilePath ?? "(not set)"}`);
	} else {
		console.log("    (not configured)");
	}

	console.log("\n  Memory Management:");

	if (effective.memory) {
		const bufferSize =
			effective.memory.maxOutputBufferBytes ?? CONFIG_DEFAULTS.memory.maxOutputBufferBytes ?? 0;

		console.log(`    maxOutputBuffer:    ${formatBytes(bufferSize)}`);
		const warningThreshold = effective.memory.memoryWarningThresholdMb;

		console.log(
			`    memoryWarning:      ${warningThreshold === 0 ? "disabled" : `${warningThreshold}MB`}`,
		);
		console.log(
			`    gcHints:            ${effective.memory.enableGarbageCollectionHints ? "enabled" : "disabled"}`,
		);
	} else {
		console.log("    (using defaults)");
	}

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);

	if (!validation.valid || validation.warnings.length > 0) {
		console.log("");
		console.log(formatValidationErrors(validation, verbose));
	} else {
		console.log("\n\x1b[32m✓\x1b[0m Configuration is valid");
		console.log("\nRun 'ralph setup' to reconfigure settings.");
	}
}
