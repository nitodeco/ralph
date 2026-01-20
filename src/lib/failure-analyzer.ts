export type FailureCategory =
	| "build_failure"
	| "test_failure"
	| "lint_error"
	| "permission_error"
	| "timeout"
	| "stuck"
	| "network_error"
	| "syntax_error"
	| "dependency_error"
	| "unknown";

export interface FailureAnalysis {
	category: FailureCategory;
	rootCause: string;
	suggestedApproach: string;
	contextInjection: string;
	shouldRetry: boolean;
}

interface FailurePattern {
	pattern: RegExp;
	category: FailureCategory;
	rootCause: string;
	suggestedApproach: string;
	contextInjection: string;
	shouldRetry: boolean;
}

const FAILURE_PATTERNS: FailurePattern[] = [
	{
		pattern: /error:?\s*ts\d+|typescript\s*error|type\s*error|cannot find module/i,
		category: "build_failure",
		rootCause: "TypeScript compilation error",
		suggestedApproach: "Fix type errors before proceeding",
		contextInjection:
			"The previous attempt failed due to TypeScript errors. Before making changes, run the TypeScript compiler to identify and fix all type errors. Pay close attention to type definitions and imports.",
		shouldRetry: true,
	},
	{
		pattern: /build\s*(failed|error)|compilation\s*(failed|error)|cannot\s*compile/i,
		category: "build_failure",
		rootCause: "Build process failed",
		suggestedApproach: "Run build command first and fix any errors",
		contextInjection:
			"The previous attempt resulted in a build failure. Before making any new changes, run the build command to see the current errors and fix them first. Ensure the codebase compiles successfully before proceeding.",
		shouldRetry: true,
	},
	{
		pattern: /test\s*(failed|failure)|assertion\s*(failed|error)|expect.*to(be|equal|match)/i,
		category: "test_failure",
		rootCause: "Test assertion failed",
		suggestedApproach: "Run tests first and fix failing tests",
		contextInjection:
			"The previous attempt caused test failures. Before continuing, run the test suite to identify which tests are failing. Fix the failing tests or update the implementation to make them pass.",
		shouldRetry: true,
	},
	{
		pattern: /lint\s*(error|failed)|eslint|biome|prettier.*error/i,
		category: "lint_error",
		rootCause: "Linting or formatting error",
		suggestedApproach: "Run linter and fix style issues",
		contextInjection:
			"The previous attempt had linting errors. Run the linter to see all issues and fix them. Follow the project's code style conventions.",
		shouldRetry: true,
	},
	{
		pattern: /permission\s*denied|eacces|access\s*denied|forbidden/i,
		category: "permission_error",
		rootCause: "File or directory permission error",
		suggestedApproach: "Check file permissions and ownership",
		contextInjection:
			"The previous attempt failed due to permission issues. Check if the files you're trying to modify have the correct permissions. You may need to use different files or directories.",
		shouldRetry: true,
	},
	{
		pattern: /timeout|timed\s*out|exceeded.*time/i,
		category: "timeout",
		rootCause: "Operation timed out",
		suggestedApproach: "Break task into smaller pieces",
		contextInjection:
			"The previous attempt timed out. The task may be too large to complete in one iteration. Focus on completing a smaller, more focused portion of the task. Consider breaking it into multiple commits.",
		shouldRetry: true,
	},
	{
		pattern: /stuck|no\s*output|unresponsive/i,
		category: "stuck",
		rootCause: "Agent became unresponsive",
		suggestedApproach: "Simplify the approach",
		contextInjection:
			"The previous attempt got stuck without producing output. Try a simpler approach. Avoid complex operations that might cause the agent to hang. Work incrementally with frequent saves.",
		shouldRetry: true,
	},
	{
		pattern: /network\s*error|econnrefused|enotfound|socket\s*hang\s*up|fetch\s*failed/i,
		category: "network_error",
		rootCause: "Network connectivity issue",
		suggestedApproach: "Check network connectivity and retry",
		contextInjection:
			"The previous attempt failed due to network issues. This may be a transient error. If the task requires network access, ensure the required services are available.",
		shouldRetry: true,
	},
	{
		pattern: /syntax\s*error|unexpected\s*token|parsing\s*error|invalid\s*syntax/i,
		category: "syntax_error",
		rootCause: "Code syntax error",
		suggestedApproach: "Fix syntax errors in the code",
		contextInjection:
			"The previous attempt introduced syntax errors. Carefully review the code for missing brackets, semicolons, or other syntax issues. Use the error message to locate the exact problem.",
		shouldRetry: true,
	},
	{
		pattern:
			/cannot\s*find\s*package|module\s*not\s*found|dependency.*not\s*found|npm\s*err|yarn\s*error|bun.*error/i,
		category: "dependency_error",
		rootCause: "Missing or incompatible dependency",
		suggestedApproach: "Install missing dependencies",
		contextInjection:
			"The previous attempt failed due to missing dependencies. Check if all required packages are installed. Run the package manager install command if needed.",
		shouldRetry: true,
	},
];

export function analyzeFailure(
	error: string,
	output: string,
	exitCode: number | null,
): FailureAnalysis {
	const combinedText = `${error}\n${output}`.toLowerCase();

	for (const pattern of FAILURE_PATTERNS) {
		if (pattern.pattern.test(combinedText)) {
			return {
				category: pattern.category,
				rootCause: pattern.rootCause,
				suggestedApproach: pattern.suggestedApproach,
				contextInjection: pattern.contextInjection,
				shouldRetry: pattern.shouldRetry,
			};
		}
	}

	const exitCodeAnalysis = analyzeExitCode(exitCode);
	if (exitCodeAnalysis) {
		return exitCodeAnalysis;
	}

	return {
		category: "unknown",
		rootCause: error || "Unknown error occurred",
		suggestedApproach: "Review the error message and try a different approach",
		contextInjection:
			"The previous attempt failed. Review what went wrong and try a different approach. Check the error message for clues about the root cause.",
		shouldRetry: true,
	};
}

function analyzeExitCode(exitCode: number | null): FailureAnalysis | null {
	if (exitCode === null) {
		return null;
	}

	if (exitCode === 1) {
		return {
			category: "unknown",
			rootCause: "General error (exit code 1)",
			suggestedApproach: "Check the output for specific error details",
			contextInjection:
				"The previous attempt failed with a general error. Carefully review any error messages and try to address the specific issue mentioned.",
			shouldRetry: true,
		};
	}

	if (exitCode === 2) {
		return {
			category: "syntax_error",
			rootCause: "Misuse of command or syntax error (exit code 2)",
			suggestedApproach: "Check command syntax and arguments",
			contextInjection:
				"The previous attempt failed due to incorrect command usage or syntax. Verify the commands being used are correct.",
			shouldRetry: true,
		};
	}

	if (exitCode >= 128) {
		const signal = exitCode - 128;
		return {
			category: "unknown",
			rootCause: `Process terminated by signal ${signal}`,
			suggestedApproach: "The process was forcefully terminated",
			contextInjection: `The previous attempt was terminated by signal ${signal}. This may indicate a timeout, memory issue, or external interruption. Try a simpler approach.`,
			shouldRetry: true,
		};
	}

	return null;
}

export function generateRetryContext(analysis: FailureAnalysis, attemptNumber: number): string {
	const attemptLabel =
		attemptNumber === 1 ? "1st" : attemptNumber === 2 ? "2nd" : `${attemptNumber}th`;

	return `
## Retry Context (${attemptLabel} retry attempt)

**Previous failure:** ${analysis.rootCause}
**Category:** ${analysis.category.replace(/_/g, " ")}
**Recommended approach:** ${analysis.suggestedApproach}

${analysis.contextInjection}

IMPORTANT: Address the issue described above before proceeding with the task. Do not repeat the same mistake.
`.trim();
}
