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
    category: "build_failure",
    contextInjection:
      "The previous attempt failed due to TypeScript errors. Before making changes, run the TypeScript compiler to identify and fix all type errors. Pay close attention to type definitions and imports.",
    pattern: /error:?\s*ts\d+|typescript\s*error|type\s*error|cannot find module/i,
    rootCause: "TypeScript compilation error",
    shouldRetry: true,
    suggestedApproach: "Fix type errors before proceeding",
  },
  {
    category: "build_failure",
    contextInjection:
      "The previous attempt resulted in a build failure. Before making any new changes, run the build command to see the current errors and fix them first. Ensure the codebase compiles successfully before proceeding.",
    pattern: /build\s*(failed|error)|compilation\s*(failed|error)|cannot\s*compile/i,
    rootCause: "Build process failed",
    shouldRetry: true,
    suggestedApproach: "Run build command first and fix any errors",
  },
  {
    category: "test_failure",
    contextInjection:
      "The previous attempt caused test failures. Before continuing, run the test suite to identify which tests are failing. Fix the failing tests or update the implementation to make them pass.",
    pattern: /test\s*(failed|failure)|assertion\s*(failed|error)|expect.*to(be|equal|match)/i,
    rootCause: "Test assertion failed",
    shouldRetry: true,
    suggestedApproach: "Run tests first and fix failing tests",
  },
  {
    category: "lint_error",
    contextInjection:
      "The previous attempt had linting errors. Run the linter to see all issues and fix them. Follow the project's code style conventions.",
    pattern: /lint\s*(error|failed)|eslint|biome|oxlint|oxfmt|prettier.*error/i,
    rootCause: "Linting or formatting error",
    shouldRetry: true,
    suggestedApproach: "Run linter and fix style issues",
  },
  {
    category: "permission_error",
    contextInjection:
      "The previous attempt failed due to permission issues. Check if the files you're trying to modify have the correct permissions. You may need to use different files or directories.",
    pattern: /permission\s*denied|eacces|access\s*denied|forbidden/i,
    rootCause: "File or directory permission error",
    shouldRetry: true,
    suggestedApproach: "Check file permissions and ownership",
  },
  {
    category: "timeout",
    contextInjection:
      "The previous attempt timed out. The task may be too large to complete in one iteration. Focus on completing a smaller, more focused portion of the task. Consider breaking it into multiple commits.",
    pattern: /timeout|timed\s*out|exceeded.*time/i,
    rootCause: "Operation timed out",
    shouldRetry: true,
    suggestedApproach: "Break task into smaller pieces",
  },
  {
    category: "stuck",
    contextInjection:
      "The previous attempt got stuck without producing output. Try a simpler approach. Avoid complex operations that might cause the agent to hang. Work incrementally with frequent saves.",
    pattern: /stuck|no\s*output|unresponsive/i,
    rootCause: "Agent became unresponsive",
    shouldRetry: true,
    suggestedApproach: "Simplify the approach",
  },
  {
    category: "network_error",
    contextInjection:
      "The previous attempt failed due to network issues. This may be a transient error. If the task requires network access, ensure the required services are available.",
    pattern: /network\s*error|econnrefused|enotfound|socket\s*hang\s*up|fetch\s*failed/i,
    rootCause: "Network connectivity issue",
    shouldRetry: true,
    suggestedApproach: "Check network connectivity and retry",
  },
  {
    category: "syntax_error",
    contextInjection:
      "The previous attempt introduced syntax errors. Carefully review the code for missing brackets, semicolons, or other syntax issues. Use the error message to locate the exact problem.",
    pattern: /syntax\s*error|unexpected\s*token|parsing\s*error|invalid\s*syntax/i,
    rootCause: "Code syntax error",
    shouldRetry: true,
    suggestedApproach: "Fix syntax errors in the code",
  },
  {
    category: "dependency_error",
    contextInjection:
      "The previous attempt failed due to missing dependencies. Check if all required packages are installed. Run the package manager install command if needed.",
    pattern:
      /cannot\s*find\s*package|module\s*not\s*found|dependency.*not\s*found|npm\s*err|yarn\s*error|bun.*error/i,
    rootCause: "Missing or incompatible dependency",
    shouldRetry: true,
    suggestedApproach: "Install missing dependencies",
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
        contextInjection: pattern.contextInjection,
        rootCause: pattern.rootCause,
        shouldRetry: pattern.shouldRetry,
        suggestedApproach: pattern.suggestedApproach,
      };
    }
  }

  const exitCodeAnalysis = analyzeExitCode(exitCode);

  if (exitCodeAnalysis) {
    return exitCodeAnalysis;
  }

  return {
    category: "unknown",
    contextInjection:
      "The previous attempt failed. Review what went wrong and try a different approach. Check the error message for clues about the root cause.",
    rootCause: error || "Unknown error occurred",
    shouldRetry: true,
    suggestedApproach: "Review the error message and try a different approach",
  };
}

function analyzeExitCode(exitCode: number | null): FailureAnalysis | null {
  if (exitCode === null) {
    return null;
  }

  if (exitCode === 1) {
    return {
      category: "unknown",
      contextInjection:
        "The previous attempt failed with a general error. Carefully review any error messages and try to address the specific issue mentioned.",
      rootCause: "General error (exit code 1)",
      shouldRetry: true,
      suggestedApproach: "Check the output for specific error details",
    };
  }

  if (exitCode === 2) {
    return {
      category: "syntax_error",
      contextInjection:
        "The previous attempt failed due to incorrect command usage or syntax. Verify the commands being used are correct.",
      rootCause: "Misuse of command or syntax error (exit code 2)",
      shouldRetry: true,
      suggestedApproach: "Check command syntax and arguments",
    };
  }

  if (exitCode >= 128) {
    const signal = exitCode - 128;

    return {
      category: "unknown",
      contextInjection: `The previous attempt was terminated by signal ${signal}. This may indicate a timeout, memory issue, or external interruption. Try a simpler approach.`,
      rootCause: `Process terminated by signal ${signal}`,
      shouldRetry: true,
      suggestedApproach: "The process was forcefully terminated",
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
