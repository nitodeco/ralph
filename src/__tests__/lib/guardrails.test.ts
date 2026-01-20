import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { DEFAULT_GUARDRAILS } from "@/lib/defaults.ts";
import {
	addGuardrail,
	formatGuardrailsForPrompt,
	getActiveGuardrails,
	getGuardrailById,
	guardrailsFileExists,
	initializeGuardrails,
	loadGuardrails,
	removeGuardrail,
	saveGuardrails,
	toggleGuardrail,
} from "@/lib/guardrails.ts";
import { ensureRalphDirExists, GUARDRAILS_FILE_PATH } from "@/lib/paths.ts";
import type { PromptGuardrail } from "@/types/config.types.ts";

const TEST_DIR = "/tmp/ralph-test-guardrails";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("guardrails functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("loadGuardrails", () => {
		test("returns default guardrails when file does not exist", () => {
			const guardrails = loadGuardrails();

			expect(guardrails.length).toBeGreaterThan(0);
			expect(guardrails).toEqual(DEFAULT_GUARDRAILS);
		});

		test("loads guardrails from file", () => {
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

			saveGuardrails(customGuardrails);

			const loaded = loadGuardrails();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Custom instruction");
		});

		test("returns defaults when file is corrupted", () => {
			writeFileSync(GUARDRAILS_FILE_PATH, "{ invalid json }");
			const guardrails = loadGuardrails();

			expect(guardrails).toEqual(DEFAULT_GUARDRAILS);
		});

		test("returns defaults when guardrails array is missing", () => {
			writeFileSync(GUARDRAILS_FILE_PATH, JSON.stringify({}));
			const guardrails = loadGuardrails();

			expect(guardrails).toEqual(DEFAULT_GUARDRAILS);
		});
	});

	describe("saveGuardrails", () => {
		test("saves guardrails to file", () => {
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

			saveGuardrails(guardrails);
			expect(guardrailsFileExists()).toBe(true);

			const loaded = loadGuardrails();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Test instruction");
		});

		test("creates directory if it does not exist", () => {
			const guardrails: PromptGuardrail[] = [];

			saveGuardrails(guardrails);
			expect(existsSync(RALPH_DIR)).toBe(true);
		});
	});

	describe("guardrailsFileExists", () => {
		test("returns false when file does not exist", () => {
			expect(guardrailsFileExists()).toBe(false);
		});

		test("returns true when file exists", () => {
			saveGuardrails([]);
			expect(guardrailsFileExists()).toBe(true);
		});
	});

	describe("initializeGuardrails", () => {
		test("creates guardrails file with defaults if it does not exist", () => {
			expect(guardrailsFileExists()).toBe(false);
			initializeGuardrails();
			expect(guardrailsFileExists()).toBe(true);
			const guardrails = loadGuardrails();

			expect(guardrails).toEqual(DEFAULT_GUARDRAILS);
		});

		test("does not overwrite existing guardrails file", () => {
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

			saveGuardrails(customGuardrails);
			initializeGuardrails();
			const loaded = loadGuardrails();

			expect(loaded).toHaveLength(1);
			expect(loaded[0]?.instruction).toBe("Custom");
		});
	});

	describe("addGuardrail", () => {
		test("adds guardrail with required fields", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({
				instruction: "New guardrail",
			});

			expect(guardrail.instruction).toBe("New guardrail");
			expect(guardrail.trigger).toBe("always");
			expect(guardrail.category).toBe("quality");
			expect(guardrail.enabled).toBe(true);
			expect(guardrail.id).toBeDefined();
			expect(guardrail.addedAt).toBeDefined();

			const loaded = loadGuardrails();

			expect(loaded.some((g) => g.id === guardrail.id)).toBe(true);
		});

		test("adds guardrail with custom options", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({
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
			initializeGuardrails();
			const initialCount = loadGuardrails().length;

			addGuardrail({ instruction: "New one" });
			expect(loadGuardrails().length).toBe(initialCount + 1);
		});
	});

	describe("removeGuardrail", () => {
		test("removes guardrail by id", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({ instruction: "To remove" });
			const id = guardrail.id;

			const removed = removeGuardrail(id);

			expect(removed).toBe(true);
			const loaded = loadGuardrails();

			expect(loaded.some((g) => g.id === id)).toBe(false);
		});

		test("returns false when guardrail not found", () => {
			initializeGuardrails();
			const removed = removeGuardrail("nonexistent-id");

			expect(removed).toBe(false);
		});

		test("preserves other guardrails when removing one", () => {
			initializeGuardrails();
			const guardrail1 = addGuardrail({ instruction: "Keep this" });
			const guardrail2 = addGuardrail({ instruction: "Remove this" });

			removeGuardrail(guardrail2.id);
			const loaded = loadGuardrails();

			expect(loaded.some((g) => g.id === guardrail1.id)).toBe(true);
			expect(loaded.some((g) => g.id === guardrail2.id)).toBe(false);
		});
	});

	describe("toggleGuardrail", () => {
		test("toggles enabled state from true to false", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({ instruction: "Test", enabled: true });
			const toggled = toggleGuardrail(guardrail.id);

			expect(toggled).not.toBeNull();
			expect(toggled?.enabled).toBe(false);

			const loaded = loadGuardrails();
			const found = loaded.find((g) => g.id === guardrail.id);

			expect(found?.enabled).toBe(false);
		});

		test("toggles enabled state from false to true", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({ instruction: "Test", enabled: false });
			const toggled = toggleGuardrail(guardrail.id);

			expect(toggled).not.toBeNull();
			expect(toggled?.enabled).toBe(true);
		});

		test("returns null when guardrail not found", () => {
			initializeGuardrails();
			const toggled = toggleGuardrail("nonexistent-id");

			expect(toggled).toBeNull();
		});
	});

	describe("getActiveGuardrails", () => {
		test("returns only enabled guardrails", () => {
			initializeGuardrails();
			addGuardrail({ instruction: "Enabled 1", enabled: true });
			addGuardrail({ instruction: "Disabled", enabled: false });
			addGuardrail({ instruction: "Enabled 2", enabled: true });

			const active = getActiveGuardrails();

			expect(active.every((g) => g.enabled)).toBe(true);
			expect(active.some((g) => g.instruction === "Disabled")).toBe(false);
		});

		test("filters by trigger when provided", () => {
			initializeGuardrails();
			addGuardrail({ instruction: "Always", trigger: "always", enabled: true });
			addGuardrail({ instruction: "On error", trigger: "on-error", enabled: true });
			addGuardrail({ instruction: "On task type", trigger: "on-task-type", enabled: true });

			const onError = getActiveGuardrails("on-error");

			expect(onError.every((g) => g.trigger === "on-error" || g.trigger === "always")).toBe(true);
			expect(onError.some((g) => g.instruction === "On task type")).toBe(false);
		});

		test("includes always trigger guardrails regardless of filter", () => {
			initializeGuardrails();
			addGuardrail({ instruction: "Always", trigger: "always", enabled: true });
			addGuardrail({ instruction: "On error", trigger: "on-error", enabled: true });

			const filtered = getActiveGuardrails("on-task-type");

			expect(filtered.some((g) => g.instruction === "Always")).toBe(true);
		});

		test("returns empty array when no active guardrails", () => {
			initializeGuardrails();
			const guardrails = loadGuardrails();

			for (const guardrail of guardrails) {
				toggleGuardrail(guardrail.id);
			}

			const active = getActiveGuardrails();

			expect(active).toEqual([]);
		});
	});

	describe("getGuardrailById", () => {
		test("returns guardrail when found", () => {
			initializeGuardrails();
			const guardrail = addGuardrail({ instruction: "Test" });
			const found = getGuardrailById(guardrail.id);

			expect(found).not.toBeNull();
			expect(found?.instruction).toBe("Test");
		});

		test("returns null when not found", () => {
			initializeGuardrails();
			const found = getGuardrailById("nonexistent-id");

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
