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
}

export interface RulesService {
	get(): CustomRule[];
	load(): CustomRule[];
	save(rules: CustomRule[]): void;
	exists(): boolean;
	initialize(): void;
	invalidate(): void;
	add(options: AddRuleOptions): CustomRule;
	remove(ruleId: string): boolean;
	getById(ruleId: string): CustomRule | null;
	formatForPrompt(rules: CustomRule[]): string;
}
