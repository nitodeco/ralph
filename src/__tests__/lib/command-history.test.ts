import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";

const testDir = join(tmpdir(), `ralph-test-command-history-${Date.now()}`);
const projectDir = join(testDir, ".ralph");
const historyFilePath = join(projectDir, "command-history.json");

describe("command-history", () => {
	beforeEach(() => {
		mkdirSync(projectDir, { recursive: true });

		bootstrapTestServices({
			projectRegistry: {
				getProjectDir: () => projectDir,
				getProjectFilePath: (relativePath: string) => join(projectDir, relativePath),
			},
		});
	});

	afterEach(() => {
		teardownTestServices();
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("loadCommandHistory", () => {
		test("returns empty history when file does not exist", async () => {
			const { loadCommandHistory } = await import("@/lib/command-history.ts");
			const history = loadCommandHistory();

			expect(history.commands).toEqual([]);
			expect(history.lastUpdated).toBeDefined();
		});

		test("loads existing history from file", async () => {
			const existingHistory = {
				commands: ["/start", "/stop", "/status"],
				lastUpdated: "2025-01-01T00:00:00.000Z",
			};

			writeFileSync(historyFilePath, JSON.stringify(existingHistory));

			const { loadCommandHistory } = await import("@/lib/command-history.ts");
			const history = loadCommandHistory();

			expect(history.commands).toEqual(["/start", "/stop", "/status"]);
		});

		test("returns empty history when file contains invalid JSON", async () => {
			writeFileSync(historyFilePath, "not valid json");

			const { loadCommandHistory } = await import("@/lib/command-history.ts");
			const history = loadCommandHistory();

			expect(history.commands).toEqual([]);
		});

		test("returns empty history when file contains invalid structure", async () => {
			writeFileSync(historyFilePath, JSON.stringify({ invalid: "structure" }));

			const { loadCommandHistory } = await import("@/lib/command-history.ts");
			const history = loadCommandHistory();

			expect(history.commands).toEqual([]);
		});
	});

	describe("addCommandToHistory", () => {
		test("adds a command to empty history", async () => {
			const { addCommandToHistory, loadCommandHistory } = await import("@/lib/command-history.ts");

			addCommandToHistory("/start");
			const history = loadCommandHistory();

			expect(history.commands).toEqual(["/start"]);
		});

		test("adds multiple commands to history", async () => {
			const { addCommandToHistory, loadCommandHistory } = await import("@/lib/command-history.ts");

			addCommandToHistory("/start");
			addCommandToHistory("/stop");
			addCommandToHistory("/status");
			const history = loadCommandHistory();

			expect(history.commands).toEqual(["/start", "/stop", "/status"]);
		});

		test("does not add duplicate consecutive commands", async () => {
			const { addCommandToHistory, loadCommandHistory } = await import("@/lib/command-history.ts");

			addCommandToHistory("/start");
			addCommandToHistory("/start");
			addCommandToHistory("/start");
			const history = loadCommandHistory();

			expect(history.commands).toEqual(["/start"]);
		});

		test("allows non-consecutive duplicate commands", async () => {
			const { addCommandToHistory, loadCommandHistory } = await import("@/lib/command-history.ts");

			addCommandToHistory("/start");
			addCommandToHistory("/stop");
			addCommandToHistory("/start");
			const history = loadCommandHistory();

			expect(history.commands).toEqual(["/start", "/stop", "/start"]);
		});

		test("limits history to MAX_HISTORY_SIZE entries", async () => {
			const { addCommandToHistory, loadCommandHistory } = await import("@/lib/command-history.ts");

			for (let i = 0; i < 110; i++) {
				addCommandToHistory(`/command${i}`);
			}

			const history = loadCommandHistory();

			expect(history.commands.length).toBe(100);
			expect(history.commands.at(0)).toBe("/command10");
			expect(history.commands.at(-1)).toBe("/command109");
		});
	});

	describe("getCommandHistoryList", () => {
		test("returns empty array when no history exists", async () => {
			const { getCommandHistoryList } = await import("@/lib/command-history.ts");
			const commands = getCommandHistoryList();

			expect(commands).toEqual([]);
		});

		test("returns list of commands", async () => {
			const existingHistory = {
				commands: ["/start", "/stop"],
				lastUpdated: "2025-01-01T00:00:00.000Z",
			};

			writeFileSync(historyFilePath, JSON.stringify(existingHistory));

			const { getCommandHistoryList } = await import("@/lib/command-history.ts");
			const commands = getCommandHistoryList();

			expect(commands).toEqual(["/start", "/stop"]);
		});
	});

	describe("clearCommandHistory", () => {
		test("clears all commands from history", async () => {
			const { addCommandToHistory, clearCommandHistory, loadCommandHistory } = await import(
				"@/lib/command-history.ts"
			);

			addCommandToHistory("/start");
			addCommandToHistory("/stop");
			clearCommandHistory();
			const history = loadCommandHistory();

			expect(history.commands).toEqual([]);
		});
	});
});
