import {
	addGuardrail,
	loadGuardrails,
	removeGuardrail,
	toggleGuardrail,
} from "@/lib/guardrails.ts";
import type { PromptGuardrail } from "@/types.ts";

interface GuardrailsOutput {
	guardrails: PromptGuardrail[];
	summary: {
		total: number;
		enabled: number;
		disabled: number;
	};
}

function formatGuardrailStatus(guardrail: PromptGuardrail): string {
	const status = guardrail.enabled ? "\x1b[32m✓\x1b[0m" : "\x1b[90m○\x1b[0m";
	const category = `\x1b[90m[${guardrail.category}]\x1b[0m`;

	return `  ${status} ${guardrail.instruction} ${category}`;
}

export function printGuardrails(version: string, jsonOutput: boolean): void {
	const guardrails = loadGuardrails();
	const enabledCount = guardrails.filter((guardrail) => guardrail.enabled).length;

	if (jsonOutput) {
		const output: GuardrailsOutput = {
			guardrails,
			summary: {
				total: guardrails.length,
				enabled: enabledCount,
				disabled: guardrails.length - enabledCount,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - Guardrails\n`);

	if (guardrails.length === 0) {
		console.log("No guardrails configured.");
		console.log("\nAdd a guardrail with: ralph guardrails add <instruction>");

		return;
	}

	console.log(`Guardrails (${enabledCount}/${guardrails.length} enabled):\n`);

	for (const guardrail of guardrails) {
		console.log(formatGuardrailStatus(guardrail));
		console.log(`    \x1b[90mid: ${guardrail.id}\x1b[0m`);
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log("\nCommands:");
	console.log("  ralph guardrails add <instruction>  Add a new guardrail");
	console.log("  ralph guardrails remove <id>        Remove a guardrail");
	console.log("  ralph guardrails toggle <id>        Enable/disable a guardrail");
}

export function handleGuardrailsAdd(instruction: string): void {
	if (!instruction.trim()) {
		console.error("\x1b[31mError:\x1b[0m Instruction cannot be empty");
		process.exit(1);
	}

	const guardrail = addGuardrail({ instruction: instruction.trim() });

	console.log(`\x1b[32m✓\x1b[0m Added guardrail: "${guardrail.instruction}"`);
	console.log(`  id: ${guardrail.id}`);
}

export function handleGuardrailsRemove(guardrailId: string): void {
	if (!guardrailId.trim()) {
		console.error("\x1b[31mError:\x1b[0m Guardrail ID is required");
		process.exit(1);
	}

	const removed = removeGuardrail(guardrailId.trim());

	if (removed) {
		console.log(`\x1b[32m✓\x1b[0m Removed guardrail: ${guardrailId}`);
	} else {
		console.error(`\x1b[31mError:\x1b[0m Guardrail not found: ${guardrailId}`);
		process.exit(1);
	}
}

export function handleGuardrailsToggle(guardrailId: string): void {
	if (!guardrailId.trim()) {
		console.error("\x1b[31mError:\x1b[0m Guardrail ID is required");
		process.exit(1);
	}

	const guardrail = toggleGuardrail(guardrailId.trim());

	if (guardrail) {
		const status = guardrail.enabled ? "enabled" : "disabled";

		console.log(`\x1b[32m✓\x1b[0m Guardrail ${status}: "${guardrail.instruction}"`);
	} else {
		console.error(`\x1b[31mError:\x1b[0m Guardrail not found: ${guardrailId}`);
		process.exit(1);
	}
}
