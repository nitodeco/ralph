import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, GUARDRAILS_FILE_PATH } from "@/lib/paths.ts";
import {
	bootstrapTestServices,
	createDefaultGuardrails,
	createGuardrailsService,
	formatGuardrailsForPrompt,
	getGuardrailsService,
	type PromptGuardrail,
	teardownTestServices,
} from "@/lib/services/index.ts";

const TEST_DIR = "/tmp/ralph-test-guardrails";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

type GuardrailWithoutTimestamp = Omit<PromptGuardrail, "addedAt">;

function normalizeGuardrails(guardrails: PromptGuardrail[]): GuardrailWithoutTimestamp[] {
	return guardrails.map((guardrail) => {
		const { addedAt, ...rest } = guardrail;

		return rest;
	});
}

describe("guardrails functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();

		bootstrapTestServices({
			guardrails: createGuardrailsService(),
		});
	});

	afterEach(() => {
		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("get/load", () => {
		test("returns default guardrails when file does not exist", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.invalidate();
			const guardrails = guardrailsService.get();

			expect(guardrails.length).toBeGreaterThan(0);
			expect(normalizeGuardrails(guardrails)).toEqual(
				normalizeGuardrails(createDefaultGuardrails()),
			);
		});

		test("loads guardrails from file", () => {
			const guardrailsService = getGuardrailsService();
			const customGuardrails: PromptGuardrail[] = [
				{
					id: "custom-1",
					instruction: "Custom instruction",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];

			guardrailsService.save(customGuardrails);
			guardrailsService.invalidate();

			const loaded = guardrailsService.get();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Custom instruction");
		});

		test("returns defaults when file is corrupted", () => {
			const guardrailsService = getGuardrailsService();

			writeFileSync(GUARDRAILS_FILE_PATH, "{ invalid json }");
			guardrailsService.invalidate();
			const guardrails = guardrailsService.get();

			expect(normalizeGuardrails(guardrails)).toEqual(
				normalizeGuardrails(createDefaultGuardrails()),
			);
		});

		test("returns defaults when guardrails array is missing", () => {
			const guardrailsService = getGuardrailsService();

			writeFileSync(GUARDRAILS_FILE_PATH, JSON.stringify({}));
			guardrailsService.invalidate();
			const guardrails = guardrailsService.get();

			expect(normalizeGuardrails(guardrails)).toEqual(
				normalizeGuardrails(createDefaultGuardrails()),
			);
		});
	});

	describe("save", () => {
		test("saves guardrails to file", () => {
			const guardrailsService = getGuardrailsService();
			const guardrails: PromptGuardrail[] = [
				{
					id: "test-1",
					instruction: "Test instruction",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];

			guardrailsService.save(guardrails);
			expect(guardrailsService.exists()).toBe(true);

			guardrailsService.invalidate();
			const loaded = guardrailsService.get();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Test instruction");
		});

		test("creates directory if it does not exist", () => {
			const guardrailsService = getGuardrailsService();
			const guardrails: PromptGuardrail[] = [];

			guardrailsService.save(guardrails);
			expect(existsSync(RALPH_DIR)).toBe(true);
		});
	});

	describe("exists", () => {
		test("returns false when file does not exist", () => {
			const guardrailsService = getGuardrailsService();

			expect(guardrailsService.exists()).toBe(false);
		});

		test("returns true when file exists", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.save([]);
			expect(guardrailsService.exists()).toBe(true);
		});
	});

	describe("initialize", () => {
		test("creates guardrails file with defaults if it does not exist", () => {
			const guardrailsService = getGuardrailsService();

			expect(guardrailsService.exists()).toBe(false);
			guardrailsService.initialize();
			expect(guardrailsService.exists()).toBe(true);
			guardrailsService.invalidate();
			const guardrails = guardrailsService.get();

			expect(normalizeGuardrails(guardrails)).toEqual(
				normalizeGuardrails(createDefaultGuardrails()),
			);
		});

		test("does not overwrite existing guardrails file", () => {
			const guardrailsService = getGuardrailsService();
			const customGuardrails: PromptGuardrail[] = [
				{
					id: "custom",
					instruction: "Custom",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];

			guardrailsService.save(customGuardrails);
			guardrailsService.initialize();
			guardrailsService.invalidate();
			const loaded = guardrailsService.get();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Custom");
		});
	});

	describe("add", () => {
		test("adds guardrail with required fields", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({
				instruction: "New guardrail",
			});

			expect(guardrail.instruction).toBe("New guardrail");
			expect(guardrail.trigger).toBe("always");
			expect(guardrail.category).toBe("quality");
			expect(guardrail.enabled).toBe(true);
			expect(guardrail.id).toBeDefined();
			expect(guardrail.addedAt).toBeDefined();

			guardrailsService.invalidate();
			const loaded = guardrailsService.get();

			expect(loaded.some((loadedGuardrail) => loadedGuardrail.id === guardrail.id)).toBe(true);
		});

		test("adds guardrail with custom options", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({
				instruction: "Custom guardrail",
				trigger: "on-error",
				category: "safety",
				enabled: false,
				addedAfterFailure: "After build failure",
			});

			expect(guardrail.trigger).toBe("on-error");
			expect(guardrail.category).toBe("safety");
			expect(guardrail.enabled).toBe(false);
			expect(guardrail.addedAfterFailure).toBe("After build failure");
		});

		test("appends to existing guardrails", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const initialCount = guardrailsService.get().length;

			guardrailsService.add({ instruction: "New one" });
			guardrailsService.invalidate();
			expect(guardrailsService.get().length).toBe(initialCount + 1);
		});
	});

	describe("remove", () => {
		test("removes guardrail by id", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({ instruction: "To remove" });
			const id = guardrail.id;

			const removed = guardrailsService.remove(id);

			expect(removed).toBe(true);
			guardrailsService.invalidate();
			const loaded = guardrailsService.get();

			expect(loaded.some((guardrail) => guardrail.id === id)).toBe(false);
		});

		test("returns false when guardrail not found", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const removed = guardrailsService.remove("nonexistent-id");

			expect(removed).toBe(false);
		});

		test("preserves other guardrails when removing one", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail1 = guardrailsService.add({ instruction: "Keep this" });
			const guardrail2 = guardrailsService.add({ instruction: "Remove this" });

			guardrailsService.remove(guardrail2.id);
			guardrailsService.invalidate();
			const loaded = guardrailsService.get();

			expect(loaded.some((guardrail) => guardrail.id === guardrail1.id)).toBe(true);
			expect(loaded.some((guardrail) => guardrail.id === guardrail2.id)).toBe(false);
		});
	});

	describe("toggle", () => {
		test("toggles enabled state from true to false", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({ instruction: "Test", enabled: true });
			const toggled = guardrailsService.toggle(guardrail.id);

			expect(toggled).not.toBeNull();
			expect(toggled?.enabled).toBe(false);

			guardrailsService.invalidate();
			const loaded = guardrailsService.get();
			const found = loaded.find((loadedGuardrail) => loadedGuardrail.id === guardrail.id);

			expect(found?.enabled).toBe(false);
		});

		test("toggles enabled state from false to true", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({ instruction: "Test", enabled: false });
			const toggled = guardrailsService.toggle(guardrail.id);

			expect(toggled).not.toBeNull();
			expect(toggled?.enabled).toBe(true);
		});

		test("returns null when guardrail not found", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const toggled = guardrailsService.toggle("nonexistent-id");

			expect(toggled).toBeNull();
		});
	});

	describe("getActive", () => {
		test("returns only enabled guardrails", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			guardrailsService.add({ instruction: "Enabled 1", enabled: true });
			guardrailsService.add({ instruction: "Disabled", enabled: false });
			guardrailsService.add({ instruction: "Enabled 2", enabled: true });

			const active = guardrailsService.getActive();

			expect(active.every((guardrail) => guardrail.enabled)).toBe(true);
			expect(active.some((guardrail) => guardrail.instruction === "Disabled")).toBe(false);
		});

		test("filters by trigger when provided", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			guardrailsService.add({ instruction: "Always", trigger: "always", enabled: true });
			guardrailsService.add({ instruction: "On error", trigger: "on-error", enabled: true });
			guardrailsService.add({
				instruction: "On task type",
				trigger: "on-task-type",
				enabled: true,
			});

			const onError = guardrailsService.getActive("on-error");

			expect(
				onError.every(
					(guardrail) => guardrail.trigger === "on-error" || guardrail.trigger === "always",
				),
			).toBe(true);
			expect(onError.some((guardrail) => guardrail.instruction === "On task type")).toBe(false);
		});

		test("includes always trigger guardrails regardless of filter", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			guardrailsService.add({ instruction: "Always", trigger: "always", enabled: true });
			guardrailsService.add({ instruction: "On error", trigger: "on-error", enabled: true });

			const filtered = guardrailsService.getActive("on-task-type");

			expect(filtered.some((guardrail) => guardrail.instruction === "Always")).toBe(true);
		});

		test("returns empty array when no active guardrails", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrails = guardrailsService.get();

			for (const guardrail of guardrails) {
				guardrailsService.toggle(guardrail.id);
			}

			const active = guardrailsService.getActive();

			expect(active).toEqual([]);
		});
	});

	describe("getById", () => {
		test("returns guardrail when found", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const guardrail = guardrailsService.add({ instruction: "Test" });
			const found = guardrailsService.getById(guardrail.id);

			expect(found).not.toBeNull();
			expect(found?.instruction).toBe("Test");
		});

		test("returns null when not found", () => {
			const guardrailsService = getGuardrailsService();

			guardrailsService.initialize();
			const found = guardrailsService.getById("nonexistent-id");

			expect(found).toBeNull();
		});
	});

	describe("formatGuardrailsForPrompt", () => {
		test("returns empty string when no guardrails", () => {
			const formatted = formatGuardrailsForPrompt([]);

			expect(formatted).toBe("");
		});

		test("formats single guardrail", () => {
			const guardrails: PromptGuardrail[] = [
				{
					id: "1",
					instruction: "Test instruction",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];
			const formatted = formatGuardrailsForPrompt(guardrails);

			expect(formatted).toContain("## Guardrails");
			expect(formatted).toContain("1. Test instruction");
		});

		test("formats multiple guardrails with numbering", () => {
			const guardrails: PromptGuardrail[] = [
				{
					id: "1",
					instruction: "First instruction",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
				{
					id: "2",
					instruction: "Second instruction",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];
			const formatted = formatGuardrailsForPrompt(guardrails);

			expect(formatted).toContain("1. First instruction");
			expect(formatted).toContain("2. Second instruction");
		});

		test("ends with newline", () => {
			const guardrails: PromptGuardrail[] = [
				{
					id: "1",
					instruction: "Test",
					trigger: "always",
					category: "quality",
					enabled: true,
					addedAt: new Date().toISOString(),
				},
			];
			const formatted = formatGuardrailsForPrompt(guardrails);

			expect(formatted).toEndWith("\n");
		});
	});
});
