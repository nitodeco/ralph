import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { checkAndRotateFile, formatTimestamp } from "./logging-utils.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./paths.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
}

interface LoggerConfig {
	logFilePath?: string;
	maxFileSizeBytes?: number;
	maxBackupFiles?: number;
	minLevel?: LogLevel;
}

const DEFAULT_LOG_FILE = `${RALPH_DIR}/ralph.log`;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_BACKUP_FILES = 3;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

function formatLogEntry(entry: LogEntry): string {
	const levelTag = `[${entry.level.toUpperCase()}]`.padEnd(7);
	const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";

	return `${entry.timestamp} ${levelTag} ${entry.message}${contextStr}`;
}

function shouldLog(logLevel: LogLevel, minLevel: LogLevel): boolean {
	return LOG_LEVEL_PRIORITY[logLevel] >= LOG_LEVEL_PRIORITY[minLevel];
}

function ensureLogDirectoryExists(logFilePath: string): void {
	const logDir = dirname(logFilePath);

	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}
}

class Logger {
	private config: Required<LoggerConfig>;

	constructor(config: LoggerConfig = {}) {
		this.config = {
			logFilePath: config.logFilePath ?? DEFAULT_LOG_FILE,
			maxFileSizeBytes: config.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE,
			maxBackupFiles: config.maxBackupFiles ?? DEFAULT_MAX_BACKUP_FILES,
			minLevel: config.minLevel ?? "debug",
		};
	}

	private writeToFile(entry: LogEntry): void {
		const formattedEntry = formatLogEntry(entry);
		const logFilePath = this.config.logFilePath;

		try {
			ensureRalphDirExists();
			ensureLogDirectoryExists(logFilePath);
			checkAndRotateFile(logFilePath, this.config.maxFileSizeBytes, this.config.maxBackupFiles);
			appendFileSync(logFilePath, `${formattedEntry}\n`);
		} catch {}
	}

	private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
		if (!shouldLog(level, this.config.minLevel)) {
			return;
		}

		const entry: LogEntry = {
			timestamp: formatTimestamp(),
			level,
			message,
			context,
		};

		this.writeToFile(entry);
	}

	debug(message: string, context?: Record<string, unknown>): void {
		this.log("debug", message, context);
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.log("info", message, context);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.log("warn", message, context);
	}

	error(message: string, context?: Record<string, unknown>): void {
		this.log("error", message, context);
	}

	logAgentStart(agent: string, prompt: string): void {
		this.info("Agent execution started", { agent, promptLength: prompt.length });
	}

	logAgentOutput(output: string): void {
		this.debug("Agent output received", { outputLength: output.length });
	}

	logAgentComplete(exitCode: number, isComplete: boolean): void {
		const level = exitCode === 0 ? "info" : "warn";

		this.log(level, "Agent execution completed", { exitCode, isComplete });
	}

	logAgentError(error: string, exitCode: number | null): void {
		this.error("Agent execution failed", { error, exitCode });
	}

	logAgentRetry(retryCount: number, maxRetries: number, delayMs: number): void {
		this.warn("Agent retry scheduled", { retryCount, maxRetries, delayMs });
	}

	logIterationStart(iteration: number, totalIterations: number): void {
		this.info("Iteration started", { iteration, totalIterations });
	}

	logIterationComplete(
		iteration: number,
		totalIterations: number,
		isProjectComplete: boolean,
	): void {
		this.info("Iteration completed", { iteration, totalIterations, isProjectComplete });
	}

	logIterationFailure(iteration: number, error: string): void {
		this.error("Iteration failed", { iteration, error });
	}

	logSessionStart(totalIterations: number, taskIndex: number): void {
		this.info("Session started", { totalIterations, taskIndex });
	}

	logSessionResume(
		currentIteration: number,
		totalIterations: number,
		elapsedTimeSeconds: number,
	): void {
		this.info("Session resumed", { currentIteration, totalIterations, elapsedTimeSeconds });
	}

	logSessionComplete(): void {
		this.info("Session completed - all tasks done");
	}

	logMaxIterationsReached(totalIterations: number): void {
		this.warn("Maximum iterations reached", { totalIterations });
	}

	updateConfig(config: Partial<LoggerConfig>): void {
		if (config.logFilePath !== undefined) {
			this.config.logFilePath = config.logFilePath;
		}

		if (config.maxFileSizeBytes !== undefined) {
			this.config.maxFileSizeBytes = config.maxFileSizeBytes;
		}

		if (config.maxBackupFiles !== undefined) {
			this.config.maxBackupFiles = config.maxBackupFiles;
		}

		if (config.minLevel !== undefined) {
			this.config.minLevel = config.minLevel;
		}
	}

	getLogFilePath(): string {
		return this.config.logFilePath;
	}
}

let loggerInstance: Logger | null = null;

export function getLogger(config?: LoggerConfig): Logger {
	if (!loggerInstance) {
		loggerInstance = new Logger(config);
	} else if (config) {
		loggerInstance.updateConfig(config);
	}

	return loggerInstance;
}

export function createLogger(config?: LoggerConfig): Logger {
	return new Logger(config);
}

export function readLogFile(logFilePath?: string): string | null {
	const filePath = logFilePath ?? DEFAULT_LOG_FILE;

	if (!existsSync(filePath)) {
		return null;
	}

	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

export function getRecentLogEntries(count: number = 50, logFilePath?: string): string[] {
	const content = readLogFile(logFilePath);

	if (!content) {
		return [];
	}

	const lines = content.trim().split("\n");

	return lines.slice(-count);
}
