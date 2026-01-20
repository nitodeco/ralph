import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { invalidatePrdCache } from "@/lib/prd.ts";

const TEST_DIR = "/tmp/ralph-test-cli";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

function getFirstCallArg(spy: ReturnType<typeof spyOn>): string {
	const calls = spy.mock.calls;
	if (calls.length === 0 || !calls[0]) {
		throw new Error("Expected spy to have been called");
	}
	return calls[0][0] as string;
}

function getAllCallArgs(spy: ReturnType<typeof spyOn>): string[] {
	return spy.mock.calls.map((call: unknown[]) => (call ? (call[0] as string) : ""));
}

describe("CLI commands", () => {
	beforeEach(() => {
		invalidatePrdCache();
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
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printHelp("1.0.0");

			expect(consoleSpy).toHaveBeenCalled();
			const output = getFirstCallArg(consoleSpy);
			expect(output).toContain("ralph v1.0.0");
			expect(output).toContain("Usage:");
			expect(output).toContain("Commands:");
			expect(output).toContain("Options:");
			expect(output).toContain("Slash Commands");

			consoleSpy.mockRestore();
		});

		test("includes all main commands", async () => {
			const { printHelp } = await import("@/cli/commands/help.ts");
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printHelp("1.0.0");

			const output = getFirstCallArg(consoleSpy);
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

			consoleSpy.mockRestore();
		});
	});

	describe("printVersion", () => {
		test("outputs version string", async () => {
			const { printVersion } = await import("@/cli/commands/help.ts");
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printVersion("1.2.3");

			expect(consoleSpy).toHaveBeenCalledWith("ralph v1.2.3");

			consoleSpy.mockRestore();
		});
	});

	describe("printList", () => {
		test("outputs error when no PRD exists", async () => {
			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

			printList("1.0.0", false, false);

			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		test("outputs JSON error when no PRD exists with --json", async () => {
			const { printList } = await import("@/cli/commands/list.ts");
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printList("1.0.0", true, false);

			expect(consoleSpy).toHaveBeenCalled();
			const output = getFirstCallArg(consoleSpy);
			const parsed = JSON.parse(output);
			expect(parsed.error).toBeDefined();
			expect(parsed.code).toBe("E010");

			consoleSpy.mockRestore();
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
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printList("1.0.0", false, false);

			const allOutput = getAllCallArgs(consoleSpy).join("\n");
			expect(allOutput).toContain("Test Project");
			expect(allOutput).toContain("Task 1");
			expect(allOutput).toContain("Task 2");
			expect(allOutput).toContain("1/2 tasks");

			consoleSpy.mockRestore();
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
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

			printList("1.0.0", true, false);

			const output = getFirstCallArg(consoleSpy);
			const parsed = JSON.parse(output);
			expect(parsed.project).toBe("Test Project");
			expect(parsed.tasks).toHaveLength(2);
			expect(parsed.summary.total).toBe(2);
			expect(parsed.summary.completed).toBe(1);
			expect(parsed.summary.pending).toBe(1);
			expect(parsed.summary.percentComplete).toBe(50);

			consoleSpy.mockRestore();
		});
	});
});
