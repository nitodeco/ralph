import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, GUARDRAILS_FILE_PATH } from "@/lib/paths.ts";
import { createDefaultGuardrails } from "./defaults.ts";
import { formatGuardrailsForPrompt } from "./formatters.ts";
import type {
	AddGuardrailOptions,
	GuardrailsFile,
	GuardrailsService,
	GuardrailTrigger,
	PromptGuardrail,
} from "./types.ts";
import { isGuardrailsFile } from "./validation.ts";

function generateGuardrailId(): string {
	return `guardrail-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function createGuardrailsService(): GuardrailsService {
	let cachedGuardrails: PromptGuardrail[] | null = null;

	function load(): PromptGuardrail[] {
		if (!existsSync(GUARDRAILS_FILE_PATH)) {
			return createDefaultGuardrails();
		}

		try {
			const content = readFileSync(GUARDRAILS_FILE_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isGuardrailsFile(parsed)) {
				return createDefaultGuardrails();
			}

			return parsed.guardrails ?? createDefaultGuardrails();
		} catch {
			return createDefaultGuardrails();
		}
	}

	function get(): PromptGuardrail[] {
		if (cachedGuardrails === null) {
			cachedGuardrails = load();
		}

		return cachedGuardrails;
	}

	function save(guardrails: PromptGuardrail[]): void {
		ensureRalphDirExists();
		const data: GuardrailsFile = { guardrails };

		writeFileSync(GUARDRAILS_FILE_PATH, JSON.stringify(data, null, "\t"), "utf-8");
		cachedGuardrails = guardrails;
	}

	function exists(): boolean {
		return existsSync(GUARDRAILS_FILE_PATH);
	}

	function initialize(): void {
		if (!exists()) {
			save(createDefaultGuardrails());
		}
	}

	function invalidate(): void {
		cachedGuardrails = null;
	}

	function add(options: AddGuardrailOptions): PromptGuardrail {
		const guardrails = get();

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
		save(guardrails);

		return newGuardrail;
	}

	function remove(guardrailId: string): boolean {
		const guardrails = get();
		const initialLength = guardrails.length;
		const filtered = guardrails.filter((guardrail) => guardrail.id !== guardrailId);

		if (filtered.length === initialLength) {
			return false;
		}

		save(filtered);

		return true;
	}

	function toggle(guardrailId: string): PromptGuardrail | null {
		const guardrails = get();
		const guardrail = guardrails.find((guardrail) => guardrail.id === guardrailId);

		if (!guardrail) {
			return null;
		}

		guardrail.enabled = !guardrail.enabled;
		save(guardrails);

		return guardrail;
	}

	function getById(guardrailId: string): PromptGuardrail | null {
		const guardrails = get();

		return guardrails.find((guardrail) => guardrail.id === guardrailId) ?? null;
	}

	function getActive(trigger?: GuardrailTrigger): PromptGuardrail[] {
		const guardrails = get();

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

	return {
		get,
		load,
		save,
		exists,
		initialize,
		invalidate,
		add,
		remove,
		toggle,
		getById,
		getActive,
		formatForPrompt: formatGuardrailsForPrompt,
	};
}
