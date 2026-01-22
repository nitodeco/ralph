import { type CustomRule, getRulesService } from "@/lib/services/index.ts";

interface RulesOutput {
	rules: CustomRule[];
	summary: {
		total: number;
	};
}

function formatRuleStatus(rule: CustomRule, index: number): string {
	return `  ${index + 1}. ${rule.instruction}`;
}

export function printRules(version: string, jsonOutput: boolean): void {
	const rules = getRulesService().get();

	if (jsonOutput) {
		const output: RulesOutput = {
			rules,
			summary: {
				total: rules.length,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - Custom Rules\n`);

	if (rules.length === 0) {
		console.log("No custom rules configured.");
		console.log("\nAdd a rule with: ralph rules add <instruction>");

		return;
	}

	console.log(`Custom Rules (${rules.length} total):\n`);

	for (const [index, rule] of rules.entries()) {
		console.log(formatRuleStatus(rule, index));
		console.log(`    \x1b[90mid: ${rule.id}\x1b[0m`);
	}

	console.log(`\n${"─".repeat(60)}`);
	console.log("\nCommands:");
	console.log("  ralph rules add <instruction>  Add a new rule");
	console.log("  ralph rules remove <id>        Remove a rule");
}

export function handleRulesAdd(instruction: string): void {
	if (!instruction.trim()) {
		console.error("\x1b[31mError:\x1b[0m Instruction cannot be empty");
		process.exit(1);
	}

	const rule = getRulesService().add({ instruction: instruction.trim() });

	console.log(`\x1b[32m✓\x1b[0m Added rule: "${rule.instruction}"`);
	console.log(`  id: ${rule.id}`);
}

export function handleRulesRemove(ruleId: string): void {
	if (!ruleId.trim()) {
		console.error("\x1b[31mError:\x1b[0m Rule ID is required");
		process.exit(1);
	}

	const removed = getRulesService().remove(ruleId.trim());

	if (removed) {
		console.log(`\x1b[32m✓\x1b[0m Removed rule: ${ruleId}`);
	} else {
		console.error(`\x1b[31mError:\x1b[0m Rule not found: ${ruleId}`);
		process.exit(1);
	}
}
