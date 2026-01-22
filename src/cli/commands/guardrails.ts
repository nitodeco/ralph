import {
	type AnalysisReport,
	formatAnalysisReport,
	generateAnalysisReport,
} from "@/lib/codebase-analyzer.ts";
import { getGuardrailsService, type PromptGuardrail } from "@/lib/services/index.ts";
import type { GuardrailsGenerateOptions } from "@/types.ts";

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
	const guardrails = getGuardrailsService().get();
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

	const guardrail = getGuardrailsService().add({ instruction: instruction.trim() });

	console.log(`\x1b[32m✓\x1b[0m Added guardrail: "${guardrail.instruction}"`);
	console.log(`  id: ${guardrail.id}`);
}

export function handleGuardrailsRemove(guardrailId: string): void {
	if (!guardrailId.trim()) {
		console.error("\x1b[31mError:\x1b[0m Guardrail ID is required");
		process.exit(1);
	}

	const removed = getGuardrailsService().remove(guardrailId.trim());

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

	const guardrail = getGuardrailsService().toggle(guardrailId.trim());

	if (guardrail) {
		const status = guardrail.enabled ? "enabled" : "disabled";

		console.log(`\x1b[32m✓\x1b[0m Guardrail ${status}: "${guardrail.instruction}"`);
	} else {
		console.error(`\x1b[31mError:\x1b[0m Guardrail not found: ${guardrailId}`);
		process.exit(1);
	}
}

interface GuardrailsGenerateOutput {
	analysis: AnalysisReport["analysis"];
	suggestedGuardrails: PromptGuardrail[];
	applied: boolean;
	addedCount: number;
	summary: AnalysisReport["summary"];
}

export function handleGuardrailsGenerate(
	options: GuardrailsGenerateOptions,
	jsonOutput: boolean,
): void {
	const report = generateAnalysisReport(process.cwd());

	if (jsonOutput) {
		const addedCount = options.apply ? report.suggestedGuardrails.length : 0;

		if (options.apply) {
			const guardrailsService = getGuardrailsService();

			for (const guardrail of report.suggestedGuardrails) {
				guardrailsService.add({
					instruction: guardrail.instruction,
					trigger: guardrail.trigger,
					category: guardrail.category,
					enabled: guardrail.enabled,
					addedAfterFailure: guardrail.addedAfterFailure,
				});
			}
		}

		const output: GuardrailsGenerateOutput = {
			analysis: report.analysis,
			suggestedGuardrails: report.suggestedGuardrails,
			applied: options.apply ?? false,
			addedCount,
			summary: report.summary,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(formatAnalysisReport(report));

	if (options.apply) {
		if (report.suggestedGuardrails.length === 0) {
			console.log("\nNo guardrails to add.");

			return;
		}

		const guardrailsService = getGuardrailsService();

		for (const guardrail of report.suggestedGuardrails) {
			guardrailsService.add({
				instruction: guardrail.instruction,
				trigger: guardrail.trigger,
				category: guardrail.category,
				enabled: guardrail.enabled,
				addedAfterFailure: guardrail.addedAfterFailure,
			});
		}

		console.log(`\n\x1b[32m✓\x1b[0m Added ${report.suggestedGuardrails.length} guardrail(s)`);
	}
}
