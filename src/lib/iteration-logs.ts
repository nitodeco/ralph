import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { ITERATION_FILENAME_PADDING } from "@/lib/constants/ui.ts";
import type {
	AgentType,
	IterationLog,
	IterationLogDecomposition,
	IterationLogError,
	IterationLogRetryContext,
	IterationLogStatus,
	IterationLogsIndex,
	IterationLogTask,
	IterationLogVerification,
} from "@/types.ts";
import { writeFileIdempotent } from "./idempotency.ts";
import { formatTimestamp } from "./logging-utils.ts";
import { ensureLogsDirExists, getLogsDir } from "./paths.ts";
import { isIterationLog, isIterationLogsIndex } from "./type-guards.ts";

const INDEX_FILE = "index.json";

function getIterationFilename(iteration: number): string {
	return `iteration-${String(iteration).padStart(ITERATION_FILENAME_PADDING, "0")}.json`;
}

function getIterationFilePath(iteration: number): string {
	return join(getLogsDir(), getIterationFilename(iteration));
}

function getIndexFilePath(): string {
	return join(getLogsDir(), INDEX_FILE);
}

export function generateSessionId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);

	return `${timestamp}-${random}`;
}

export function initializeLogsIndex(sessionId: string, projectName: string): void {
	ensureLogsDirExists();

	const index: IterationLogsIndex = {
		sessionId,
		projectName,
		startedAt: formatTimestamp(),
		lastUpdatedAt: formatTimestamp(),
		iterations: [],
	};

	writeFileIdempotent(getIndexFilePath(), JSON.stringify(index, null, 2));
}

export function loadIterationLogsIndex(): IterationLogsIndex | null {
	const indexPath = getIndexFilePath();

	if (!existsSync(indexPath)) {
		return null;
	}

	try {
		const content = readFileSync(indexPath, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isIterationLogsIndex(parsed)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

function updateLogsIndex(iteration: number, status: IterationLogStatus): void {
	const index = loadIterationLogsIndex();

	if (!index) {
		return;
	}

	const existingEntryIndex = index.iterations.findIndex((entry) => entry.iteration === iteration);

	const existingEntry = index.iterations.at(existingEntryIndex);

	if (existingEntryIndex >= 0 && existingEntry) {
		existingEntry.status = status;
	} else {
		index.iterations.push({
			iteration,
			status,
			filename: getIterationFilename(iteration),
		});
	}

	index.lastUpdatedAt = formatTimestamp();
	writeFileIdempotent(getIndexFilePath(), JSON.stringify(index, null, 2));
}

export interface StartIterationLogOptions {
	iteration: number;
	totalIterations: number;
	task: IterationLogTask | null;
	agentType: AgentType;
}

export function startIterationLog(options: StartIterationLogOptions): void {
	ensureLogsDirExists();

	const { iteration, totalIterations, task, agentType } = options;

	const log: IterationLog = {
		iteration,
		totalIterations,
		startedAt: formatTimestamp(),
		completedAt: null,
		durationMs: null,
		status: "running",
		task,
		agent: {
			type: agentType,
			exitCode: null,
			retryCount: 0,
			outputLength: 0,
		},
		errors: [],
	};

	writeFileIdempotent(getIterationFilePath(iteration), JSON.stringify(log, null, 2));
	updateLogsIndex(iteration, "running");
}

export function loadIterationLog(iteration: number): IterationLog | null {
	const filePath = getIterationFilePath(iteration);

	if (!existsSync(filePath)) {
		return null;
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isIterationLog(parsed)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

export interface CompleteIterationLogOptions {
	iteration: number;
	status: IterationLogStatus;
	exitCode: number | null;
	retryCount: number;
	outputLength: number;
	taskWasCompleted: boolean;
	retryContexts?: IterationLogRetryContext[];
	verification?: IterationLogVerification;
	decomposition?: IterationLogDecomposition;
}

export function completeIterationLog(options: CompleteIterationLogOptions): void {
	const {
		iteration,
		status,
		exitCode,
		retryCount,
		outputLength,
		taskWasCompleted,
		retryContexts,
		verification,
		decomposition,
	} = options;

	const log = loadIterationLog(iteration);

	if (!log) {
		return;
	}

	const completedAt = formatTimestamp();
	const startTime = new Date(log.startedAt).getTime();
	const endTime = new Date(completedAt).getTime();

	log.completedAt = completedAt;
	log.durationMs = endTime - startTime;
	log.status = status;
	log.agent.exitCode = exitCode;
	log.agent.retryCount = retryCount;
	log.agent.outputLength = outputLength;

	if (retryContexts && retryContexts.length > 0) {
		log.agent.retryContexts = retryContexts;
	}

	if (verification) {
		log.verification = verification;
	}

	if (decomposition) {
		log.decomposition = decomposition;
	}

	if (log.task) {
		log.task.wasCompleted = taskWasCompleted;
	}

	writeFileIdempotent(getIterationFilePath(iteration), JSON.stringify(log, null, 2));
	updateLogsIndex(iteration, status);
}

export function appendIterationError(
	iteration: number,
	error: string,
	context?: Record<string, unknown>,
): void {
	const log = loadIterationLog(iteration);

	if (!log) {
		return;
	}

	const errorEntry: IterationLogError = {
		timestamp: formatTimestamp(),
		message: error,
		context,
	};

	log.errors.push(errorEntry);
	writeFileIdempotent(getIterationFilePath(iteration), JSON.stringify(log, null, 2));
}

export function updateIterationAgentInfo(
	iteration: number,
	updates: Partial<{ retryCount: number; outputLength: number }>,
): void {
	const log = loadIterationLog(iteration);

	if (!log) {
		return;
	}

	if (updates.retryCount !== undefined) {
		log.agent.retryCount = updates.retryCount;
	}

	if (updates.outputLength !== undefined) {
		log.agent.outputLength = updates.outputLength;
	}

	writeFileIdempotent(getIterationFilePath(iteration), JSON.stringify(log, null, 2));
}

export function cleanupOldLogs(maxAgeDays: number): number {
	const logsDir = getLogsDir();

	if (!existsSync(logsDir)) {
		return 0;
	}

	const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
	const now = Date.now();
	let deletedCount = 0;

	try {
		const files = readdirSync(logsDir);

		for (const file of files) {
			if (file === INDEX_FILE) {
				continue;
			}

			const filePath = join(logsDir, file);

			try {
				const stats = statSync(filePath);

				if (now - stats.mtimeMs > maxAgeMs) {
					unlinkSync(filePath);
					deletedCount++;
				}
			} catch {
				// File may have been deleted by another process, ignore
			}
		}

		if (deletedCount > 0) {
			const index = loadIterationLogsIndex();

			if (index) {
				index.iterations = index.iterations.filter((entry) => {
					const filePath = join(getLogsDir(), entry.filename);

					return existsSync(filePath);
				});
				index.lastUpdatedAt = formatTimestamp();
				writeFileIdempotent(getIndexFilePath(), JSON.stringify(index, null, 2));
			}
		}
	} catch {
		return deletedCount;
	}

	return deletedCount;
}

export function getAllIterationLogs(): IterationLog[] {
	const index = loadIterationLogsIndex();

	if (!index) {
		return [];
	}

	const logs: IterationLog[] = [];

	for (const entry of index.iterations) {
		const log = loadIterationLog(entry.iteration);

		if (log) {
			logs.push(log);
		}
	}

	return logs;
}

export function* iterateIterationLogs(): Generator<IterationLog> {
	const index = loadIterationLogsIndex();

	if (!index) {
		return;
	}

	for (const entry of index.iterations) {
		const log = loadIterationLog(entry.iteration);

		if (log) {
			yield log;
		}
	}
}
