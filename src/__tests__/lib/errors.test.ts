import { describe, expect, test } from "bun:test";
import {
	categorizeAgentError,
	createError,
	ErrorCode,
	formatError,
	formatErrorCompact,
	getErrorSuggestion,
} from "@/lib/errors.ts";

describe("createError", () => {
	test("creates error with code and message", () => {
		const error = createError(ErrorCode.CONFIG_NOT_FOUND, "Config file not found");
		expect(error.code).toBe(ErrorCode.CONFIG_NOT_FOUND);
		expect(error.message).toBe("Config file not found");
		expect(error.suggestion).toBeDefined();
	});

	test("creates error with details", () => {
		const error = createError(ErrorCode.PRD_NOT_FOUND, "PRD not found", { path: "/test/prd.json" });
		expect(error.details).toEqual({ path: "/test/prd.json" });
	});

	test("includes suggestion from error code", () => {
		const error = createError(ErrorCode.AGENT_NOT_FOUND, "Agent not found");
		expect(error.suggestion).toContain("install");
	});
});

describe("formatError", () => {
	test("formats basic error", () => {
		const error = createError(ErrorCode.CONFIG_NOT_FOUND, "Config file not found");
		const formatted = formatError(error);
		expect(formatted).toContain("Error [E001]");
		expect(formatted).toContain("Config file not found");
		expect(formatted).toContain("Suggestion:");
	});

	test("includes details in verbose mode", () => {
		const error = createError(ErrorCode.PRD_NOT_FOUND, "PRD not found", {
			searchedPaths: ["/a", "/b"],
		});
		const formatted = formatError(error, true);
		expect(formatted).toContain("Details:");
		expect(formatted).toContain("searchedPaths");
	});

	test("excludes details in non-verbose mode", () => {
		const error = createError(ErrorCode.PRD_NOT_FOUND, "PRD not found", {
			searchedPaths: ["/a", "/b"],
		});
		const formatted = formatError(error, false);
		expect(formatted).not.toContain("Details:");
	});
});

describe("formatErrorCompact", () => {
	test("formats error in single line", () => {
		const error = createError(ErrorCode.SESSION_NOT_FOUND, "No session found");
		const formatted = formatErrorCompact(error);
		expect(formatted).toBe("[E030] No session found");
	});
});

describe("getErrorSuggestion", () => {
	test("returns suggestion for known error code", () => {
		const suggestion = getErrorSuggestion(ErrorCode.CONFIG_NOT_FOUND);
		expect(suggestion).toBeDefined();
		expect(suggestion).toContain("ralph setup");
	});

	test("returns suggestion for all error codes", () => {
		const errorCodes = Object.values(ErrorCode);
		for (const code of errorCodes) {
			const suggestion = getErrorSuggestion(code);
			expect(suggestion).toBeDefined();
		}
	});
});

describe("categorizeAgentError", () => {
	test("categorizes command not found error", () => {
		const result = categorizeAgentError("command not found: agent", 127);
		expect(result.code).toBe(ErrorCode.AGENT_NOT_FOUND);
		expect(result.isFatal).toBe(true);
	});

	test("categorizes not executable error", () => {
		const result = categorizeAgentError("not executable", 126);
		expect(result.code).toBe(ErrorCode.AGENT_NOT_EXECUTABLE);
		expect(result.isFatal).toBe(true);
	});

	test("categorizes authentication error", () => {
		const result = categorizeAgentError("Invalid API key", null);
		expect(result.code).toBe(ErrorCode.AGENT_AUTH_FAILED);
		expect(result.isFatal).toBe(true);
	});

	test("categorizes permission denied error", () => {
		const result = categorizeAgentError("Permission denied", null);
		expect(result.code).toBe(ErrorCode.AGENT_PERMISSION_DENIED);
		expect(result.isFatal).toBe(true);
	});

	test("categorizes timeout error", () => {
		const result = categorizeAgentError("Operation timed out", null);
		expect(result.code).toBe(ErrorCode.AGENT_TIMEOUT);
		expect(result.isFatal).toBe(false);
	});

	test("categorizes stuck error", () => {
		const result = categorizeAgentError("Agent stuck, no output", null);
		expect(result.code).toBe(ErrorCode.AGENT_STUCK);
		expect(result.isFatal).toBe(false);
	});

	test("returns unknown for unrecognized errors", () => {
		const result = categorizeAgentError("Some random error", 1);
		expect(result.code).toBe(ErrorCode.UNKNOWN);
		expect(result.isFatal).toBe(false);
	});

	test("handles case insensitive matching", () => {
		const result = categorizeAgentError("AUTHENTICATION FAILED", null);
		expect(result.code).toBe(ErrorCode.AGENT_AUTH_FAILED);
	});
});

describe("ErrorCode enum", () => {
	test("has unique codes for each error type", () => {
		const codes = Object.values(ErrorCode);
		const uniqueCodes = new Set(codes);
		expect(uniqueCodes.size).toBe(codes.length);
	});

	test("config errors start with E00x", () => {
		expect(ErrorCode.CONFIG_NOT_FOUND).toBe("E001");
		expect(ErrorCode.CONFIG_INVALID_JSON).toBe("E002");
		expect(ErrorCode.CONFIG_VALIDATION_FAILED).toBe("E003");
		expect(ErrorCode.CONFIG_MISSING_AGENT).toBe("E004");
	});

	test("PRD errors start with E01x", () => {
		expect(ErrorCode.PRD_NOT_FOUND).toBe("E010");
		expect(ErrorCode.PRD_INVALID_FORMAT).toBe("E011");
		expect(ErrorCode.PRD_NO_TASKS).toBe("E012");
		expect(ErrorCode.PRD_TASK_NOT_FOUND).toBe("E013");
	});

	test("agent errors start with E02x", () => {
		expect(ErrorCode.AGENT_NOT_FOUND).toBe("E020");
		expect(ErrorCode.AGENT_NOT_EXECUTABLE).toBe("E021");
		expect(ErrorCode.AGENT_TIMEOUT).toBe("E022");
		expect(ErrorCode.AGENT_STUCK).toBe("E023");
	});

	test("session errors start with E03x", () => {
		expect(ErrorCode.SESSION_NOT_FOUND).toBe("E030");
		expect(ErrorCode.SESSION_CORRUPTED).toBe("E031");
		expect(ErrorCode.SESSION_ALREADY_RUNNING).toBe("E032");
	});

	test("daemon errors start with E04x", () => {
		expect(ErrorCode.DAEMON_START_FAILED).toBe("E040");
		expect(ErrorCode.DAEMON_STOP_FAILED).toBe("E041");
		expect(ErrorCode.DAEMON_NOT_RUNNING).toBe("E042");
	});
});
