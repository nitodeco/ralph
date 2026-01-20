import { describe, expect, test } from "bun:test";
import type { FailureAnalysis } from "@/lib/failure-analyzer.ts";
import { analyzeFailure, generateRetryContext } from "@/lib/failure-analyzer.ts";

describe("analyzeFailure", () => {
	test("categorizes TypeScript build errors", () => {
		const result = analyzeFailure("TypeScript error TS2345", "", null);

		expect(result.category).toBe("build_failure");
		expect(result.rootCause).toBe("TypeScript compilation error");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes build failures", () => {
		const result = analyzeFailure("Build failed with errors", "", null);

		expect(result.category).toBe("build_failure");
		expect(result.rootCause).toBe("Build process failed");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes test failures", () => {
		const result = analyzeFailure("Test failed: assertion error", "", null);

		expect(result.category).toBe("test_failure");
		expect(result.rootCause).toBe("Test assertion failed");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes lint errors", () => {
		const result = analyzeFailure("ESLint error: unused variable", "", null);

		expect(result.category).toBe("lint_error");
		expect(result.rootCause).toBe("Linting or formatting error");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes permission errors", () => {
		const result = analyzeFailure("Permission denied: cannot write file", "", null);

		expect(result.category).toBe("permission_error");
		expect(result.rootCause).toBe("File or directory permission error");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes timeout errors", () => {
		const result = analyzeFailure("Operation timed out after 30 seconds", "", null);

		expect(result.category).toBe("timeout");
		expect(result.rootCause).toBe("Operation timed out");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes stuck errors", () => {
		const result = analyzeFailure("Agent stuck, no output for 5 minutes", "", null);

		expect(result.category).toBe("stuck");
		expect(result.rootCause).toBe("Agent became unresponsive");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes network errors", () => {
		const result = analyzeFailure("Network error: ECONNREFUSED", "", null);

		expect(result.category).toBe("network_error");
		expect(result.rootCause).toBe("Network connectivity issue");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes syntax errors", () => {
		const result = analyzeFailure("Syntax error: unexpected token", "", null);

		expect(result.category).toBe("syntax_error");
		expect(result.rootCause).toBe("Code syntax error");
		expect(result.shouldRetry).toBe(true);
	});

	test("categorizes dependency errors", () => {
		const result = analyzeFailure("Cannot find package 'lodash'", "", null);

		expect(result.category).toBe("dependency_error");
		expect(result.rootCause).toBe("Missing or incompatible dependency");
		expect(result.shouldRetry).toBe(true);
	});

	test("checks both error and output for patterns", () => {
		const result = analyzeFailure("", "Build failed with compilation errors", null);

		expect(result.category).toBe("build_failure");
	});

	test("is case insensitive", () => {
		const result = analyzeFailure("PERMISSION DENIED", "", null);

		expect(result.category).toBe("permission_error");
	});

	test("handles exit code 1 as unknown", () => {
		const result = analyzeFailure("Some error", "", 1);

		expect(result.category).toBe("unknown");
		expect(result.rootCause).toBe("General error (exit code 1)");
		expect(result.shouldRetry).toBe(true);
	});

	test("handles exit code 2 as syntax error", () => {
		const result = analyzeFailure("Command error", "", 2);

		expect(result.category).toBe("syntax_error");
		expect(result.rootCause).toBe("Misuse of command or syntax error (exit code 2)");
		expect(result.shouldRetry).toBe(true);
	});

	test("handles exit codes >= 128 as signal termination", () => {
		const result = analyzeFailure("Process killed", "", 130);

		expect(result.category).toBe("unknown");
		expect(result.rootCause).toBe("Process terminated by signal 2");
		expect(result.shouldRetry).toBe(true);
	});

	test("prefers pattern match over exit code", () => {
		const result = analyzeFailure("Build failed", "", 1);

		expect(result.category).toBe("build_failure");
		expect(result.rootCause).toBe("Build process failed");
	});

	test("returns unknown category for unrecognized errors", () => {
		const result = analyzeFailure("Some random error message", "", null);

		expect(result.category).toBe("unknown");
		expect(result.rootCause).toBe("Some random error message");
		expect(result.shouldRetry).toBe(true);
	});

	test("handles empty error string", () => {
		const result = analyzeFailure("", "", null);

		expect(result.category).toBe("unknown");
		expect(result.rootCause).toBe("Unknown error occurred");
	});

	test("includes context injection in result", () => {
		const result = analyzeFailure("Build failed", "", null);

		expect(result.contextInjection).toBeDefined();
		expect(result.contextInjection.length).toBeGreaterThan(0);
	});

	test("includes suggested approach in result", () => {
		const result = analyzeFailure("Test failed", "", null);

		expect(result.suggestedApproach).toBeDefined();
		expect(result.suggestedApproach.length).toBeGreaterThan(0);
	});
});

describe("generateRetryContext", () => {
	test("formats 1st retry attempt correctly", () => {
		const analysis: FailureAnalysis = {
			category: "build_failure",
			rootCause: "Build process failed",
			suggestedApproach: "Run build command first",
			contextInjection: "The previous attempt failed...",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 1);

		expect(context).toContain("1st retry attempt");
		expect(context).toContain("**Previous failure:** Build process failed");
		expect(context).toContain("**Category:** build failure");
		expect(context).toContain("**Recommended approach:** Run build command first");
		expect(context).toContain("The previous attempt failed...");
		expect(context).toContain("IMPORTANT:");
	});

	test("formats 2nd retry attempt correctly", () => {
		const analysis: FailureAnalysis = {
			category: "test_failure",
			rootCause: "Test assertion failed",
			suggestedApproach: "Fix failing tests",
			contextInjection: "Tests are failing",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 2);

		expect(context).toContain("2nd retry attempt");
		expect(context).toContain("**Previous failure:** Test assertion failed");
		expect(context).toContain("**Category:** test failure");
	});

	test("formats 3rd retry attempt correctly", () => {
		const analysis: FailureAnalysis = {
			category: "timeout",
			rootCause: "Operation timed out",
			suggestedApproach: "Break into smaller pieces",
			contextInjection: "Timeout occurred",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 3);

		expect(context).toContain("3th retry attempt");
	});

	test("formats higher numbered attempts correctly", () => {
		const analysis: FailureAnalysis = {
			category: "unknown",
			rootCause: "Unknown error",
			suggestedApproach: "Review error",
			contextInjection: "Error occurred",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 5);

		expect(context).toContain("5th retry attempt");
	});

	test("replaces underscores in category with spaces", () => {
		const analysis: FailureAnalysis = {
			category: "build_failure",
			rootCause: "Error",
			suggestedApproach: "Fix it",
			contextInjection: "Context",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 1);

		expect(context).toContain("**Category:** build failure");
		expect(context).not.toContain("build_failure");
	});

	test("includes all required sections", () => {
		const analysis: FailureAnalysis = {
			category: "permission_error",
			rootCause: "Permission denied",
			suggestedApproach: "Check permissions",
			contextInjection: "Permission issue occurred",
			shouldRetry: true,
		};
		const context = generateRetryContext(analysis, 1);

		expect(context).toContain("Retry Context");
		expect(context).toContain("Previous failure:");
		expect(context).toContain("Category:");
		expect(context).toContain("Recommended approach:");
		expect(context).toContain("IMPORTANT:");
	});
});
