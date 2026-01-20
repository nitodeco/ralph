export enum ErrorCode {
	CONFIG_NOT_FOUND = "E001",
	CONFIG_INVALID_JSON = "E002",
	CONFIG_VALIDATION_FAILED = "E003",
	CONFIG_MISSING_AGENT = "E004",

	PRD_NOT_FOUND = "E010",
	PRD_INVALID_FORMAT = "E011",
	PRD_NO_TASKS = "E012",
	PRD_TASK_NOT_FOUND = "E013",

	AGENT_NOT_FOUND = "E020",
	AGENT_NOT_EXECUTABLE = "E021",
	AGENT_TIMEOUT = "E022",
	AGENT_STUCK = "E023",
	AGENT_AUTH_FAILED = "E024",
	AGENT_PERMISSION_DENIED = "E025",
	AGENT_MAX_RETRIES = "E026",

	SESSION_NOT_FOUND = "E030",
	SESSION_CORRUPTED = "E031",
	SESSION_ALREADY_RUNNING = "E032",

	DAEMON_START_FAILED = "E040",
	DAEMON_STOP_FAILED = "E041",
	DAEMON_NOT_RUNNING = "E042",

	UNKNOWN = "E999",
}

export interface RalphError {
	code: ErrorCode;
	message: string;
	suggestion?: string;
	details?: Record<string, unknown>;
}

const ERROR_SUGGESTIONS: Record<ErrorCode, string> = {
	[ErrorCode.CONFIG_NOT_FOUND]:
		"Run 'ralph setup' to create a configuration file, or create .ralph/config.json manually.",
	[ErrorCode.CONFIG_INVALID_JSON]:
		"Check your config file for syntax errors. Use a JSON validator to find issues.",
	[ErrorCode.CONFIG_VALIDATION_FAILED]:
		"Review the validation errors above and fix the invalid fields in your config file.",
	[ErrorCode.CONFIG_MISSING_AGENT]:
		"Add an 'agent' field to your config. Valid options: 'cursor' or 'claude'.",

	[ErrorCode.PRD_NOT_FOUND]:
		"Run 'ralph init' to create a PRD file, or create .ralph/prd.json manually.",
	[ErrorCode.PRD_INVALID_FORMAT]:
		"Check your PRD file for syntax errors. Ensure it's valid JSON or YAML.",
	[ErrorCode.PRD_NO_TASKS]:
		"Add tasks to your PRD file. Each task needs a 'title' and optionally 'description' and 'steps'.",
	[ErrorCode.PRD_TASK_NOT_FOUND]:
		"Check the task identifier. Use 'ralph list' to see available tasks with their indices.",

	[ErrorCode.AGENT_NOT_FOUND]:
		"Ensure the agent CLI is installed. For Cursor: install the Cursor agent. For Claude: run 'npm install -g @anthropic-ai/claude-code'.",
	[ErrorCode.AGENT_NOT_EXECUTABLE]:
		"Check file permissions for the agent executable. Try reinstalling the agent CLI.",
	[ErrorCode.AGENT_TIMEOUT]:
		"The agent took too long. Try increasing 'agentTimeoutMs' in your config, or break the task into smaller pieces.",
	[ErrorCode.AGENT_STUCK]:
		"The agent stopped producing output. Try increasing 'stuckThresholdMs' or check if the agent is waiting for input.",
	[ErrorCode.AGENT_AUTH_FAILED]:
		"Check your API key or authentication. Ensure you're logged in to the agent CLI.",
	[ErrorCode.AGENT_PERMISSION_DENIED]:
		"The agent lacks permissions. Check file/directory permissions or run with appropriate privileges.",
	[ErrorCode.AGENT_MAX_RETRIES]:
		"The agent failed repeatedly. Check the logs for the root cause, or increase 'maxRetries' in your config.",

	[ErrorCode.SESSION_NOT_FOUND]: "No active session found. Run 'ralph' to start a new session.",
	[ErrorCode.SESSION_CORRUPTED]:
		"The session file is corrupted. Delete .ralph/session.json and start a new session.",
	[ErrorCode.SESSION_ALREADY_RUNNING]:
		"A Ralph session is already running. Use 'ralph stop' to stop it first.",

	[ErrorCode.DAEMON_START_FAILED]:
		"Failed to start background process. Check if another instance is running, or try running in foreground mode.",
	[ErrorCode.DAEMON_STOP_FAILED]:
		"Failed to stop background process. Try 'kill <pid>' manually if the process is stuck.",
	[ErrorCode.DAEMON_NOT_RUNNING]: "No background process is running. Nothing to stop.",

	[ErrorCode.UNKNOWN]: "An unexpected error occurred. Check the logs for more details.",
};

export function createError(
	code: ErrorCode,
	message: string,
	details?: Record<string, unknown>,
): RalphError {
	return {
		code,
		message,
		suggestion: ERROR_SUGGESTIONS[code],
		details,
	};
}

export function formatError(error: RalphError, verbose = false): string {
	const lines: string[] = [];

	lines.push(`Error [${error.code}]: ${error.message}`);

	if (error.suggestion) {
		lines.push("");
		lines.push(`Suggestion: ${error.suggestion}`);
	}

	if (verbose && error.details && Object.keys(error.details).length > 0) {
		lines.push("");
		lines.push("Details:");
		for (const [key, value] of Object.entries(error.details)) {
			lines.push(`  ${key}: ${JSON.stringify(value)}`);
		}
	}

	return lines.join("\n");
}

export function formatErrorCompact(error: RalphError): string {
	return `[${error.code}] ${error.message}`;
}

export function getErrorSuggestion(code: ErrorCode): string | undefined {
	return ERROR_SUGGESTIONS[code];
}

export function categorizeAgentError(
	errorMessage: string,
	exitCode: number | null,
): { code: ErrorCode; isFatal: boolean } {
	const lowerError = errorMessage.toLowerCase();

	if (/command not found/i.test(errorMessage) || exitCode === 127) {
		return { code: ErrorCode.AGENT_NOT_FOUND, isFatal: true };
	}

	if (/not executable/i.test(errorMessage) || exitCode === 126) {
		return { code: ErrorCode.AGENT_NOT_EXECUTABLE, isFatal: true };
	}

	if (
		/invalid api key|authentication failed|unauthorized/i.test(errorMessage) ||
		lowerError.includes("auth")
	) {
		return { code: ErrorCode.AGENT_AUTH_FAILED, isFatal: true };
	}

	if (/permission denied|access denied/i.test(errorMessage)) {
		return { code: ErrorCode.AGENT_PERMISSION_DENIED, isFatal: true };
	}

	if (/timeout|timed out/i.test(errorMessage)) {
		return { code: ErrorCode.AGENT_TIMEOUT, isFatal: false };
	}

	if (/stuck|no output/i.test(errorMessage)) {
		return { code: ErrorCode.AGENT_STUCK, isFatal: false };
	}

	return { code: ErrorCode.UNKNOWN, isFatal: false };
}

export function printError(error: RalphError, verbose = false): void {
	console.error(formatError(error, verbose));
}

export function printErrorWithContext(error: RalphError, context: string, verbose = false): void {
	console.error(`\n${context}:`);
	console.error(formatError(error, verbose));
}
