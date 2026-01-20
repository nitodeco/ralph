export type GuardrailTrigger = "always" | "on-error" | "on-task-type";
export type GuardrailCategory = "safety" | "quality" | "style" | "process";

export interface PromptGuardrail {
	id: string;
	instruction: string;
	trigger: GuardrailTrigger;
	category: GuardrailCategory;
	enabled: boolean;
	addedAt: string;
	addedAfterFailure?: string;
}

export interface GuardrailsFile {
	guardrails: PromptGuardrail[];
}

export interface AddGuardrailOptions {
	instruction: string;
	trigger?: GuardrailTrigger;
	category?: GuardrailCategory;
	enabled?: boolean;
	addedAfterFailure?: string;
}

export interface GuardrailsService {
	get(): PromptGuardrail[];
	load(): PromptGuardrail[];
	save(guardrails: PromptGuardrail[]): void;
	exists(): boolean;
	initialize(): void;
	invalidate(): void;
	add(options: AddGuardrailOptions): PromptGuardrail;
	remove(guardrailId: string): boolean;
	toggle(guardrailId: string): PromptGuardrail | null;
	getById(guardrailId: string): PromptGuardrail | null;
	getActive(trigger?: GuardrailTrigger): PromptGuardrail[];
	formatForPrompt(guardrails: PromptGuardrail[]): string;
}

export const VALID_GUARDRAIL_TRIGGERS: GuardrailTrigger[] = ["always", "on-error", "on-task-type"];
export const VALID_GUARDRAIL_CATEGORIES: GuardrailCategory[] = [
	"safety",
	"quality",
	"style",
	"process",
];
