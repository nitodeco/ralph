export type RuleScope = "global" | "project";

export interface CustomRule {
	id: string;
	instruction: string;
	addedAt: string;
}

export interface RulesFile {
	rules: CustomRule[];
}

export interface AddRuleOptions {
	instruction: string;
	scope?: RuleScope;
}

export interface RulesService {
	get(): CustomRule[];
	getGlobal(): CustomRule[];
	getProject(): CustomRule[];
	load(): CustomRule[];
	loadGlobal(): CustomRule[];
	loadProject(): CustomRule[];
	save(rules: CustomRule[]): void;
	saveGlobal(rules: CustomRule[]): void;
	saveProject(rules: CustomRule[]): void;
	exists(): boolean;
	existsGlobal(): boolean;
	existsProject(): boolean;
	initialize(): void;
	invalidate(): void;
	invalidateGlobal(): void;
	invalidateProject(): void;
	add(options: AddRuleOptions): CustomRule;
	remove(ruleId: string, scope?: RuleScope): boolean;
	getById(ruleId: string): CustomRule | null;
	getByIdInScope(ruleId: string, scope: RuleScope): CustomRule | null;
	formatForPrompt(rules: CustomRule[]): string;
}
