import { CLI_SEPARATOR_WIDTH } from "@/lib/constants/ui.ts";
import { type CustomRule, getRulesService, type RuleScope } from "@/lib/services/index.ts";

interface RulesOutput {
	globalRules: CustomRule[];
	projectRules: CustomRule[];
	summary: {
		globalTotal: number;
		projectTotal: number;
		total: number;
	};
}

function formatRuleStatus(rule: CustomRule, index: number): string {
	return `  ${index + 1}. ${rule.instruction}`;
}

function printRulesSection(rules: CustomRule[], sectionTitle: string, startIndex: number): number {
	if (rules.length === 0) {
		console.log(`\n${sectionTitle}: (none)`);

		return startIndex;
	}

	console.log(`\n${sectionTitle}:`);

	for (const [index, rule] of rules.entries()) {
		console.log(formatRuleStatus(rule, startIndex + index));
		console.log(`    \x1b[90mid: ${rule.id}\x1b[0m`);
	}

	return startIndex + rules.length;
}

export function printRules(version: string, jsonOutput: boolean): void {
	const rulesService = getRulesService();
	const globalRules = rulesService.getGlobal();
	const projectRules = rulesService.getProject();
	const totalCount = globalRules.length + projectRules.length;

	if (jsonOutput) {
		const output: RulesOutput = {
			globalRules,
			projectRules,
			summary: {
				globalTotal: globalRules.length,
				projectTotal: projectRules.length,
				total: totalCount,
			},
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - Custom Rules\n`);

	if (totalCount === 0) {
		console.log("No custom rules configured.");
		console.log("\nAdd a rule with:");
		console.log("  ralph rules add <instruction>          Add to this project");
		console.log("  ralph rules add <instruction> --global Add globally");

		return;
	}

	console.log(`Custom Rules (${totalCount} total):`);

	const indexAfterGlobal = printRulesSection(globalRules, "Global Rules", 0);

	printRulesSection(projectRules, "Project Rules", indexAfterGlobal);

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);
	console.log("\nCommands:");
	console.log("  ralph rules add <instruction>            Add a project rule");
	console.log("  ralph rules add <instruction> --global   Add a global rule");
	console.log("  ralph rules remove <id>                  Remove a rule");
}

export function handleRulesAdd(instruction: string, isGlobal: boolean): void {
	if (!instruction.trim()) {
		console.error("\x1b[31mError:\x1b[0m Instruction cannot be empty");
		process.exit(1);
	}

	const scope: RuleScope = isGlobal ? "global" : "project";
	const rule = getRulesService().add({ instruction: instruction.trim(), scope });
	const scopeLabel = isGlobal ? "global" : "project";

	console.log(`\x1b[32m✓\x1b[0m Added ${scopeLabel} rule: "${rule.instruction}"`);
	console.log(`  id: ${rule.id}`);
}

export function handleRulesRemove(ruleId: string): void {
	if (!ruleId.trim()) {
		console.error("\x1b[31mError:\x1b[0m Rule ID is required");
		process.exit(1);
	}

	const rulesService = getRulesService();
	const trimmedId = ruleId.trim();

	const maybeProjectRule = rulesService.getByIdInScope(trimmedId, "project");
	const maybeGlobalRule = rulesService.getByIdInScope(trimmedId, "global");

	if (maybeProjectRule) {
		rulesService.remove(trimmedId, "project");
		console.log(`\x1b[32m✓\x1b[0m Removed project rule: ${trimmedId}`);
	} else if (maybeGlobalRule) {
		rulesService.remove(trimmedId, "global");
		console.log(`\x1b[32m✓\x1b[0m Removed global rule: ${trimmedId}`);
	} else {
		console.error(`\x1b[31mError:\x1b[0m Rule not found: ${trimmedId}`);
		process.exit(1);
	}
}
