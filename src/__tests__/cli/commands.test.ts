import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const TEST_DIR = "/tmp/ralph-test-cli";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("CLI commands", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("printHelp", () => {
		test("outputs help text with version", async () => {
			const { printHelp } = await import("@/cli/commands/help.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printHelp("1.0.0");

			console.log = originalLog;

			expect(consoleSpy).toHaveBeenCalled();
			const output = consoleSpy.mock.calls[0]?.[0] as string;
			expect(output).toContain("ralph v1.0.0");
			expect(output).toContain("Usage:");
			expect(output).toContain("Commands:");
			expect(output).toContain("Options:");
			expect(output).toContain("Slash Commands");
		});

		test("includes all main commands", async () => {
			const { printHelp } = await import("@/cli/commands/help.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printHelp("1.0.0");

			console.log = originalLog;

			const output = consoleSpy.mock.calls[0]?.[0] as string;
			expect(output).toContain("init");
			expect(output).toContain("resume");
			expect(output).toContain("status");
			expect(output).toContain("stop");
			expect(output).toContain("list");
			expect(output).toContain("config");
			expect(output).toContain("archive");
			expect(output).toContain("setup");
			expect(output).toContain("update");
			expect(output).toContain("help");
		});
	});

	describe("printVersion", () => {
		test("outputs version string", async () => {
			const { printVersion } = await import("@/cli/commands/help.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printVersion("1.2.3");

			console.log = originalLog;

			expect(consoleSpy).toHaveBeenCalledWith("ralph v1.2.3");
		});
	});

	describe("printList", () => {
		test("outputs error when no PRD exists", async () => {
			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = mock(() => {});
			const originalError = console.error;
			console.error = consoleSpy;

			printList("1.0.0", false, false);

			console.error = originalError;

			expect(consoleSpy).toHaveBeenCalled();
		});

		test("outputs JSON error when no PRD exists with --json", async () => {
			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printList("1.0.0", true, false);

			console.log = originalLog;

			expect(consoleSpy).toHaveBeenCalled();
			const output = consoleSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(output);
			expect(parsed.error).toBeDefined();
			expect(parsed.code).toBe("E010");
		});

		test("outputs task list when PRD exists", async () => {
			const prd = {
				project: "Test Project",
				tasks: [
					{ title: "Task 1", description: "First task", steps: ["Step 1"], done: true },
					{ title: "Task 2", description: "Second task", steps: ["Step 1"], done: false },
				],
			};
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify(prd));

			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printList("1.0.0", false, false);

			console.log = originalLog;

			const allOutput = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
			expect(allOutput).toContain("Test Project");
			expect(allOutput).toContain("Task 1");
			expect(allOutput).toContain("Task 2");
			expect(allOutput).toContain("1/2 tasks");
		});

		test("outputs JSON task list when PRD exists with --json", async () => {
			const prd = {
				project: "Test Project",
				tasks: [
					{ title: "Task 1", description: "First task", steps: ["Step 1"], done: true },
					{ title: "Task 2", description: "Second task", steps: ["Step 1"], done: false },
				],
			};
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify(prd));

			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = mock(() => {});
			const originalLog = console.log;
			console.log = consoleSpy;

			printList("1.0.0", true, false);

			console.log = originalLog;

			const output = consoleSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(output);
			expect(parsed.project).toBe("Test Project");
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.summary.total).toBe(2);
			expect(parsed.summary.completed).toBe(1);
			expect(parsed.summary.pending).toBe(1);
			expect(parsed.summary.percentComplete).toBe(50);
		});
	});
});
