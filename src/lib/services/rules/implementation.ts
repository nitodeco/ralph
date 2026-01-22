import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "@/lib/idempotency.ts";
import { ensureProjectDirExists, getRulesFilePath } from "@/lib/paths.ts";
import { formatRulesForPrompt } from "./formatters.ts";
import type { AddRuleOptions, CustomRule, RulesFile, RulesService } from "./types.ts";
import { isRulesFile } from "./validation.ts";

function generateRuleId(): string {
	return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function createRulesService(): RulesService {
	let cachedRules: CustomRule[] | null = null;

	function load(): CustomRule[] {
		const rulesFilePath = getRulesFilePath();

		if (!existsSync(rulesFilePath)) {
			return [];
		}

		try {
			const content = readFileSync(rulesFilePath, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isRulesFile(parsed)) {
				return [];
			}

			return parsed.rules ?? [];
		} catch {
			return [];
		}
	}

	function get(): CustomRule[] {
		if (cachedRules === null) {
			cachedRules = load();
		}

		return cachedRules;
	}

	function save(rules: CustomRule[]): void {
		ensureProjectDirExists();
		const rulesData: RulesFile = { rules };

		writeFileIdempotent(getRulesFilePath(), JSON.stringify(rulesData, null, "\t"));
		cachedRules = rules;
	}

	function exists(): boolean {
		return existsSync(getRulesFilePath());
	}

	function initialize(): void {
		if (!exists()) {
			save([]);
		}
	}

	function invalidate(): void {
		cachedRules = null;
	}

	function add(options: AddRuleOptions): CustomRule {
		const rules = get();

		const newRule: CustomRule = {
			id: generateRuleId(),
			instruction: options.instruction,
			addedAt: new Date().toISOString(),
		};

		rules.push(newRule);
		save(rules);

		return newRule;
	}

	function remove(ruleId: string): boolean {
		const rules = get();
		const initialLength = rules.length;
		const filtered = rules.filter((rule) => rule.id !== ruleId);

		if (filtered.length === initialLength) {
			return false;
		}

		save(filtered);

		return true;
	}

	function getById(ruleId: string): CustomRule | null {
		const rules = get();

		return rules.find((rule) => rule.id === ruleId) ?? null;
	}

	return {
		get,
		load,
		save,
		exists,
		initialize,
		invalidate,
		add,
		remove,
		getById,
		formatForPrompt: formatRulesForPrompt,
	};
}
