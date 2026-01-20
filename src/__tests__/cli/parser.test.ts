import { describe, expect, test } from "bun:test";
import { parseArgs } from "@/cli/parser.ts";
import { DEFAULTS } from "@/lib/defaults.ts";

describe("parseArgs", () => {
	test("defaults to run command with default iterations", () => {
		const result = parseArgs(["node", "ralph"]);
		expect(result.command).toBe("run");
		expect(result.iterations).toBe(DEFAULTS.iterations);
		expect(result.background).toBe(false);
		expect(result.json).toBe(false);
		expect(result.dryRun).toBe(false);
		expect(result.verbose).toBe(false);
	});

	test("parses run command with iterations", () => {
		const result = parseArgs(["node", "ralph", "run", "5"]);
		expect(result.command).toBe("run");
		expect(result.iterations).toBe(5);
	});

	test("parses resume command with iterations", () => {
		const result = parseArgs(["node", "ralph", "resume", "3"]);
		expect(result.command).toBe("resume");
		expect(result.iterations).toBe(3);
	});

	test("parses --background flag", () => {
		const result = parseArgs(["node", "ralph", "--background"]);
		expect(result.background).toBe(true);
	});

	test("parses -b shorthand for background", () => {
		const result = parseArgs(["node", "ralph", "-b"]);
		expect(result.background).toBe(true);
	});

	test("parses --json flag", () => {
		const result = parseArgs(["node", "ralph", "--json"]);
		expect(result.json).toBe(true);
	});

	test("parses --dry-run flag", () => {
		const result = parseArgs(["node", "ralph", "--dry-run"]);
		expect(result.dryRun).toBe(true);
	});

	test("parses --verbose flag", () => {
		const result = parseArgs(["node", "ralph", "--verbose"]);
		expect(result.verbose).toBe(true);
	});

	test("parses --task flag with value", () => {
		const result = parseArgs(["node", "ralph", "--task", "Implement login"]);
		expect(result.task).toBe("Implement login");
	});

	test("parses -t shorthand for task", () => {
		const result = parseArgs(["node", "ralph", "-t", "Implement login"]);
		expect(result.task).toBe("Implement login");
	});

	test("parses --max-runtime flag", () => {
		const result = parseArgs(["node", "ralph", "--max-runtime", "3600"]);
		expect(result.maxRuntimeMs).toBe(3600000);
	});

	test("parses --max-runtime-ms flag", () => {
		const result = parseArgs(["node", "ralph", "--max-runtime-ms", "1800"]);
		expect(result.maxRuntimeMs).toBe(1800000);
	});

	test("ignores invalid max-runtime values", () => {
		const result = parseArgs(["node", "ralph", "--max-runtime", "invalid"]);
		expect(result.maxRuntimeMs).toBeUndefined();
	});

	test("ignores negative max-runtime values", () => {
		const result = parseArgs(["node", "ralph", "--max-runtime", "-100"]);
		expect(result.maxRuntimeMs).toBeUndefined();
	});

	test("parses init command", () => {
		const result = parseArgs(["node", "ralph", "init"]);
		expect(result.command).toBe("init");
	});

	test("parses setup command", () => {
		const result = parseArgs(["node", "ralph", "setup"]);
		expect(result.command).toBe("setup");
	});

	test("parses status command", () => {
		const result = parseArgs(["node", "ralph", "status"]);
		expect(result.command).toBe("status");
	});

	test("parses stop command", () => {
		const result = parseArgs(["node", "ralph", "stop"]);
		expect(result.command).toBe("stop");
	});

	test("parses help command", () => {
		const result = parseArgs(["node", "ralph", "help"]);
		expect(result.command).toBe("help");
	});

	test("parses config command", () => {
		const result = parseArgs(["node", "ralph", "config"]);
		expect(result.command).toBe("config");
	});

	test("parses list command", () => {
		const result = parseArgs(["node", "ralph", "list"]);
		expect(result.command).toBe("list");
	});

	test("parses stats command", () => {
		const result = parseArgs(["node", "ralph", "stats"]);
		expect(result.command).toBe("stats");
	});

	test("parses archive command", () => {
		const result = parseArgs(["node", "ralph", "archive"]);
		expect(result.command).toBe("archive");
	});

	test("parses update command", () => {
		const result = parseArgs(["node", "ralph", "update"]);
		expect(result.command).toBe("update");
	});

	test("parses version command", () => {
		const result = parseArgs(["node", "ralph", "version"]);
		expect(result.command).toBe("version");
	});

	test("handles multiple flags together", () => {
		const result = parseArgs([
			"node",
			"ralph",
			"run",
			"5",
			"--background",
			"--verbose",
			"--task",
			"My Task",
		]);
		expect(result.command).toBe("run");
		expect(result.iterations).toBe(5);
		expect(result.background).toBe(true);
		expect(result.verbose).toBe(true);
		expect(result.task).toBe("My Task");
	});

	test("filters out daemon-child flag", () => {
		const result = parseArgs(["node", "ralph", "--daemon-child", "run"]);
		expect(result.command).toBe("run");
	});

	test("ignores invalid iteration values", () => {
		const result = parseArgs(["node", "ralph", "run", "invalid"]);
		expect(result.iterations).toBe(DEFAULTS.iterations);
	});

	test("ignores zero iteration value", () => {
		const result = parseArgs(["node", "ralph", "run", "0"]);
		expect(result.iterations).toBe(DEFAULTS.iterations);
	});

	test("ignores negative iteration value", () => {
		const result = parseArgs(["node", "ralph", "run", "-5"]);
		expect(result.iterations).toBe(DEFAULTS.iterations);
	});
});
