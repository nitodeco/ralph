import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_GUARDRAILS } from "@/lib/defaults.ts";
import { ensureRalphDirExists, GUARDRAILS_FILE_PATH } from "@/lib/paths.ts";
import type { GuardrailCategory, GuardrailTrigger, PromptGuardrail } from "@/types/config.types.ts";

export interface GuardrailsFile {
	guardrails: PromptGuardrail[];
}

function generateGuardrailId(): string {
	return `guardrail-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function loadGuardrails(): PromptGuardrail[] {
	if (!existsSync(GUARDRAILS_FILE_PATH)) {
		return [...DEFAULT_GUARDRAILS];
	}

	try {
		const content = readFileSync(GUARDRAILS_FILE_PATH, "utf-8");
		const parsed = JSON.parse(content) as GuardrailsFile;
		return parsed.guardrails ?? [...DEFAULT_GUARDRAILS];
	} catch {
		return [...DEFAULT_GUARDRAILS];
	}
}

export function saveGuardrails(guardrails: PromptGuardrail[]): void {
	ensureRalphDirExists();
	const data: GuardrailsFile = { guardrails };
	writeFileSync(GUARDRAILS_FILE_PATH, JSON.stringify(data, null, "\t"), "utf-8");
}

export function guardrailsFileExists(): boolean {
	return existsSync(GUARDRAILS_FILE_PATH);
}

export function initializeGuardrails(): void {
	if (!guardrailsFileExists()) {
		saveGuardrails([...DEFAULT_GUARDRAILS]);
	}
}

export interface AddGuardrailOptions {
	instruction: string;
	trigger?: GuardrailTrigger;
	category?: GuardrailCategory;
	enabled?: boolean;
	addedAfterFailure?: string;
}

export function addGuardrail(options: AddGuardrailOptions): PromptGuardrail {
	const guardrails = loadGuardrails();

	const newGuardrail: PromptGuardrail = {
		id: generateGuardrailId(),
		instruction: options.instruction,
		trigger: options.trigger ?? "always",
		category: options.category ?? "quality",
		enabled: options.enabled ?? true,
		addedAt: new Date().toISOString(),
		addedAfterFailure: options.addedAfterFailure,
	};

	guardrails.push(newGuardrail);
	saveGuardrails(guardrails);

	return newGuardrail;
}

export function removeGuardrail(guardrailId: string): boolean {
	const guardrails = loadGuardrails();
	const initialLength = guardrails.length;
	const filtered = guardrails.filter((guardrail) => guardrail.id !== guardrailId);

	if (filtered.length === initialLength) {
		return false;
	}

	saveGuardrails(filtered);
	return true;
}

export function toggleGuardrail(guardrailId: string): PromptGuardrail | null {
	const guardrails = loadGuardrails();
	const guardrail = guardrails.find((guardrail) => guardrail.id === guardrailId);

	if (!guardrail) {
		return null;
	}

	guardrail.enabled = !guardrail.enabled;
	saveGuardrails(guardrails);

	return guardrail;
}

export function getActiveGuardrails(trigger?: GuardrailTrigger): PromptGuardrail[] {
	const guardrails = loadGuardrails();

	return guardrails.filter((guardrail) => {
		if (!guardrail.enabled) {
			return false;
		}

		if (trigger && guardrail.trigger !== trigger && guardrail.trigger !== "always") {
			return false;
		}

		return true;
	});
}

export function getGuardrailById(guardrailId: string): PromptGuardrail | null {
	const guardrails = loadGuardrails();
	return guardrails.find((guardrail) => guardrail.id === guardrailId) ?? null;
}

export function formatGuardrailsForPrompt(guardrails: PromptGuardrail[]): string {
	if (guardrails.length === 0) {
		return "";
	}

	const formattedRules = guardrails
		.map((guardrail, index) => `${index + 1}. ${guardrail.instruction}`)
		.join("\n");

	return `## Guardrails\n${formattedRules}\n`;
}
