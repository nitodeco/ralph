import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "@/lib/idempotency.ts";
import {
	ensureGlobalRalphDirExists,
	ensureProjectDirExists,
	getGlobalRulesFilePath,
	getRulesFilePath,
} from "@/lib/paths.ts";
import { formatRulesForPrompt } from "./formatters.ts";
import type { AddRuleOptions, CustomRule, RuleScope, RulesFile, RulesService } from "./types.ts";
import { isRulesFile } from "./validation.ts";

function generateRuleId(): string {
	return `rule-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function createRulesService(): RulesService {
	let cachedGlobalRules: CustomRule[] | null = null;
	let cachedProjectRules: CustomRule[] | null = null;

	function loadFromPath(filePath: string): CustomRule[] {
		if (!existsSync(filePath)) {
			return [];
		}

		try {
			const content = readFileSync(filePath, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isRulesFile(parsed)) {
				return [];
			}

			return parsed.rules ?? [];
		} catch {
			return [];
		}
	}

	function loadGlobal(): CustomRule[] {
		return loadFromPath(getGlobalRulesFilePath());
	}

	function loadProject(): CustomRule[] {
		return loadFromPath(getRulesFilePath());
	}

	function load(): CustomRule[] {
		return [...loadGlobal(), ...loadProject()];
	}

	function getGlobal(): CustomRule[] {
		if (cachedGlobalRules === null) {
			cachedGlobalRules = loadGlobal();
		}

		return cachedGlobalRules;
	}

	function getProject(): CustomRule[] {
		if (cachedProjectRules === null) {
			cachedProjectRules = loadProject();
		}

		return cachedProjectRules;
	}

	function get(): CustomRule[] {
		return [...getGlobal(), ...getProject()];
	}

	function saveGlobal(rules: CustomRule[]): void {
		ensureGlobalRalphDirExists();
		const rulesData: RulesFile = { rules };

		writeFileIdempotent(getGlobalRulesFilePath(), JSON.stringify(rulesData, null, "\t"));
		cachedGlobalRules = rules;
	}

	function saveProject(rules: CustomRule[]): void {
		ensureProjectDirExists();
		const rulesData: RulesFile = { rules };

		writeFileIdempotent(getRulesFilePath(), JSON.stringify(rulesData, null, "\t"));
		cachedProjectRules = rules;
	}

	function save(rules: CustomRule[]): void {
		saveProject(rules);
	}

	function existsGlobal(): boolean {
		return existsSync(getGlobalRulesFilePath());
	}

	function existsProject(): boolean {
		return existsSync(getRulesFilePath());
	}

	function exists(): boolean {
		return existsProject();
	}

	function initialize(): void {
		if (!existsProject()) {
			saveProject([]);
		}
	}

	function invalidateGlobal(): void {
		cachedGlobalRules = null;
	}

	function invalidateProject(): void {
		cachedProjectRules = null;
	}

	function invalidate(): void {
		invalidateGlobal();
		invalidateProject();
	}

	function add(options: AddRuleOptions): CustomRule {
		const scope = options.scope ?? "project";

		const newRule: CustomRule = {
			id: generateRuleId(),
			instruction: options.instruction,
			addedAt: new Date().toISOString(),
		};

		if (scope === "global") {
			const globalRules = getGlobal();

			globalRules.push(newRule);
			saveGlobal(globalRules);
		} else {
			const projectRules = getProject();

			projectRules.push(newRule);
			saveProject(projectRules);
		}

		return newRule;
	}

	function remove(ruleId: string, scope?: RuleScope): boolean {
		if (scope === "global") {
			const globalRules = getGlobal();
			const initialLength = globalRules.length;
			const filtered = globalRules.filter((rule) => rule.id !== ruleId);

			if (filtered.length === initialLength) {
				return false;
			}

			saveGlobal(filtered);

			return true;
		}

		if (scope === "project") {
			const projectRules = getProject();
			const initialLength = projectRules.length;
			const filtered = projectRules.filter((rule) => rule.id !== ruleId);

			if (filtered.length === initialLength) {
				return false;
			}

			saveProject(filtered);

			return true;
		}

		const projectRules = getProject();
		const projectFiltered = projectRules.filter((rule) => rule.id !== ruleId);

		if (projectFiltered.length !== projectRules.length) {
			saveProject(projectFiltered);

			return true;
		}

		const globalRules = getGlobal();
		const globalFiltered = globalRules.filter((rule) => rule.id !== ruleId);

		if (globalFiltered.length !== globalRules.length) {
			saveGlobal(globalFiltered);

			return true;
		}

		return false;
	}

	function getByIdInScope(ruleId: string, scope: RuleScope): CustomRule | null {
		const rules = scope === "global" ? getGlobal() : getProject();

		return rules.find((rule) => rule.id === ruleId) ?? null;
	}

	function getById(ruleId: string): CustomRule | null {
		const rules = get();

		return rules.find((rule) => rule.id === ruleId) ?? null;
	}

	return {
		get,
		getGlobal,
		getProject,
		load,
		loadGlobal,
		loadProject,
		save,
		saveGlobal,
		saveProject,
		exists,
		existsGlobal,
		existsProject,
		initialize,
		invalidate,
		invalidateGlobal,
		invalidateProject,
		add,
		remove,
		getById,
		getByIdInScope,
		formatForPrompt: formatRulesForPrompt,
	};
}
