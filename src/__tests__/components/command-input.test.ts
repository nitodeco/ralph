import { describe, expect, test } from "bun:test";
import { getAutocompleteHint, getCommonPrefix } from "@/components/CommandInput.tsx";

describe("getCommonPrefix", () => {
	test("returns empty string for empty array", () => {
		expect(getCommonPrefix([])).toBe("");
	});

	test("returns the command for single-element array", () => {
		expect(getCommonPrefix(["start"])).toBe("start");
	});

	test("returns common prefix for commands with shared beginning", () => {
		expect(getCommonPrefix(["guardrail", "guardrails"])).toBe("guardrail");
	});

	test("returns empty string for commands with no common prefix", () => {
		expect(getCommonPrefix(["start", "quit"])).toBe("");
	});

	test("returns shortest common prefix for multiple commands", () => {
		expect(getCommonPrefix(["session", "status", "setup"])).toBe("s");
	});

	test("handles commands that are prefixes of each other", () => {
		expect(getCommonPrefix(["task", "tasks"])).toBe("task");
	});

	test("returns full match when all commands are identical", () => {
		expect(getCommonPrefix(["help", "help", "help"])).toBe("help");
	});

	test("handles single character common prefix", () => {
		expect(getCommonPrefix(["agent", "add", "analyze", "auth"])).toBe("a");
	});
});

describe("getAutocompleteHint", () => {
	describe("when not running", () => {
		test("returns default for empty input", () => {
			const result = getAutocompleteHint("", false);

			expect(result.type).toBe("default");
		});

		test("returns default for input without leading slash", () => {
			const result = getAutocompleteHint("start", false);

			expect(result.type).toBe("default");
		});

		test("returns suggestions for partial command", () => {
			const result = getAutocompleteHint("/se", false);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.length).toBeGreaterThan(0);
			expect(result.suggestions?.some((s) => s.command === "session")).toBe(true);
			expect(result.suggestions?.some((s) => s.command === "setup")).toBe(true);
		});

		test("includes common prefix in suggestions result", () => {
			const result = getAutocompleteHint("/se", false);

			expect(result.type).toBe("suggestions");
			expect(result.commonPrefix).toBe("se");
		});

		test("returns suggestions for guardrail prefix (before exact match)", () => {
			const result = getAutocompleteHint("/guardr", false);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.length).toBe(2);
			expect(result.suggestions?.some((s) => s.command === "guardrail")).toBe(true);
			expect(result.suggestions?.some((s) => s.command === "guardrails")).toBe(true);
			expect(result.commonPrefix).toBe("guardrail");
		});

		test("returns argument hint for exact guardrail command", () => {
			const result = getAutocompleteHint("/guardrail", false);

			expect(result.type).toBe("argument-hint");
			expect(result.argumentHint).toContain("<text>");
		});

		test("returns argument hint for exact command with args", () => {
			const result = getAutocompleteHint("/session", false);

			expect(result.type).toBe("argument-hint");
			expect(result.argumentHint).toContain("/session");
			expect(result.argumentHint).toContain("<start|stop|resume|pause|clear|refresh|archive>");
		});

		test("returns default for exact command without args", () => {
			const result = getAutocompleteHint("/help", false);

			expect(result.type).toBe("default");
		});

		test("returns default for exact command when args already entered", () => {
			const result = getAutocompleteHint("/session start", false);

			expect(result.type).toBe("default");
		});

		test("returns default for command with args already entered", () => {
			const result = getAutocompleteHint("/session start 10", false);

			expect(result.type).toBe("default");
		});

		test("returns single suggestion for unique partial match", () => {
			const result = getAutocompleteHint("/hel", false);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.length).toBe(1);
			expect(result.suggestions?.at(0)?.command).toBe("help");
			expect(result.commonPrefix).toBe("help");
		});

		test("is case insensitive", () => {
			const result = getAutocompleteHint("/SESSION", false);

			expect(result.type).toBe("argument-hint");
		});

		test("returns default for unknown command", () => {
			const result = getAutocompleteHint("/xyz", false);

			expect(result.type).toBe("default");
		});
	});

	describe("when running", () => {
		test("only shows running commands for partial match", () => {
			const result = getAutocompleteHint("/se", true);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.every((s) => ["session", "status"].includes(s.command))).toBe(
				true,
			);
		});

		test("returns default for non-running command", () => {
			const result = getAutocompleteHint("/add", true);

			expect(result.type).toBe("default");
		});

		test("returns argument hint for valid running command", () => {
			const result = getAutocompleteHint("/help", true);

			expect(result.type).toBe("default");
		});

		test("returns suggestions for quit/exit prefix", () => {
			const result = getAutocompleteHint("/qu", true);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.some((s) => s.command === "quit")).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("shows all commands for just a slash", () => {
			const result = getAutocompleteHint("/", false);

			expect(result.type).toBe("suggestions");
			expect(result.suggestions?.length).toBeGreaterThan(10);
		});

		test("shows all commands for slash with empty partial", () => {
			const result = getAutocompleteHint("/  ", false);

			expect(result.type).toBe("suggestions");
		});

		test("handles command with extra whitespace", () => {
			const result = getAutocompleteHint("  /session  ", false);

			expect(result.type).toBe("argument-hint");
		});
	});
});
