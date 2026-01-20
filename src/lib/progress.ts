import {
	appendFileSync,
	existsSync,
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";

export const PROGRESS_FILE_PATH = `${RALPH_DIR}/progress.txt`;

export type ProgressEntryType =
	| "session_start"
	| "session_resume"
	| "iteration_start"
	| "iteration_complete"
	| "task_complete"
	| "error"
	| "retry"
	| "session_complete"
	| "session_stopped"
	| "max_iterations";

export interface ProgressEntry {
	timestamp: string;
	type: ProgressEntryType;
	iteration?: number;
	totalIterations?: number;
	message: string;
	context?: Record<string, unknown>;
}

export interface SessionSummary {
	projectName: string;
	startedAt: string;
	lastUpdatedAt: string;
	totalIterations: number;
	completedIterations: number;
	tasksCompleted: number;
	totalTasks: number;
	status: string;
}

const DEFAULT_MAX_FILE_SIZE_BYTES = 1024 * 1024;
const DEFAULT_MAX_BACKUP_FILES = 2;

function formatTimestamp(): string {
	return new Date().toISOString();
}

function formatEntryLine(entry: ProgressEntry): string {
	const iterationInfo =
		entry.iteration !== undefined ? `[Iteration ${entry.iteration}/${entry.totalIterations}] ` : "";
	const typeTag = `[${entry.type.toUpperCase().replace("_", " ")}]`;
	const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : "";
	return `${entry.timestamp} ${typeTag} ${iterationInfo}${entry.message}${contextStr}`;
}

function formatSessionSummary(summary: SessionSummary): string {
	const lines = [
		"=".repeat(60),
		"SESSION SUMMARY",
		"=".repeat(60),
		`Project: ${summary.projectName}`,
		`Started: ${summary.startedAt}`,
		`Last Updated: ${summary.lastUpdatedAt}`,
		`Status: ${summary.status}`,
		`Iterations: ${summary.completedIterations} / ${summary.totalIterations}`,
		`Tasks: ${summary.tasksCompleted} / ${summary.totalTasks}`,
		"=".repeat(60),
		"",
		"PROGRESS LOG",
		"-".repeat(60),
		"",
	];
	return lines.join("\n");
}

function rotateProgressFile(maxBackupFiles: number): void {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		return;
	}

	for (let backupIndex = maxBackupFiles - 1; backupIndex >= 0; backupIndex--) {
		const currentBackup =
			backupIndex === 0 ? PROGRESS_FILE_PATH : `${PROGRESS_FILE_PATH}.${backupIndex}`;
		const nextBackup = `${PROGRESS_FILE_PATH}.${backupIndex + 1}`;

		if (existsSync(currentBackup)) {
			if (backupIndex === maxBackupFiles - 1) {
				continue;
			}
			try {
				renameSync(currentBackup, nextBackup);
			} catch {}
		}
	}
}

function checkAndRotate(
	maxFileSizeBytes: number = DEFAULT_MAX_FILE_SIZE_BYTES,
	maxBackupFiles: number = DEFAULT_MAX_BACKUP_FILES,
): void {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		return;
	}

	try {
		const stats = statSync(PROGRESS_FILE_PATH);
		if (stats.size >= maxFileSizeBytes) {
			rotateProgressFile(maxBackupFiles);
		}
	} catch {}
}

export function writeProgressEntry(entry: ProgressEntry): void {
	ensureRalphDirExists();
	checkAndRotate();

	const line = formatEntryLine(entry);
	appendFileSync(PROGRESS_FILE_PATH, `${line}\n`);
}

export function initializeProgressFile(summary: SessionSummary): void {
	ensureRalphDirExists();
	checkAndRotate();

	const headerContent = formatSessionSummary(summary);
	writeFileSync(PROGRESS_FILE_PATH, headerContent);
}

export function updateSessionSummaryInFile(summary: SessionSummary): void {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		initializeProgressFile(summary);
		return;
	}

	const content = readFileSync(PROGRESS_FILE_PATH, "utf-8");
	const progressLogMarker = "PROGRESS LOG";
	const markerIndex = content.indexOf(progressLogMarker);

	if (markerIndex === -1) {
		initializeProgressFile(summary);
		return;
	}

	const progressLogContent = content.substring(markerIndex);
	const newHeader = formatSessionSummary(summary);
	const newContent =
		newHeader.substring(0, newHeader.indexOf(progressLogMarker)) + progressLogContent;

	writeFileSync(PROGRESS_FILE_PATH, newContent);
}

export function logSessionStart(
	projectName: string,
	totalIterations: number,
	totalTasks: number,
	completedTasks: number,
): void {
	const timestamp = formatTimestamp();
	const summary: SessionSummary = {
		projectName,
		startedAt: timestamp,
		lastUpdatedAt: timestamp,
		totalIterations,
		completedIterations: 0,
		tasksCompleted: completedTasks,
		totalTasks,
		status: "Running",
	};

	initializeProgressFile(summary);

	const entry: ProgressEntry = {
		timestamp,
		type: "session_start",
		iteration: 0,
		totalIterations,
		message: `Session started for project "${projectName}"`,
		context: { totalTasks, completedTasks },
	};

	writeProgressEntry(entry);
}

export function logSessionResume(
	projectName: string,
	currentIteration: number,
	totalIterations: number,
	totalTasks: number,
	completedTasks: number,
): void {
	const timestamp = formatTimestamp();

	const entry: ProgressEntry = {
		timestamp,
		type: "session_resume",
		iteration: currentIteration,
		totalIterations,
		message: `Session resumed for project "${projectName}"`,
		context: { totalTasks, completedTasks },
	};

	writeProgressEntry(entry);

	const summary: SessionSummary = {
		projectName,
		startedAt: timestamp,
		lastUpdatedAt: timestamp,
		totalIterations,
		completedIterations: currentIteration,
		tasksCompleted: completedTasks,
		totalTasks,
		status: "Running",
	};

	updateSessionSummaryInFile(summary);
}

export function logIterationStart(
	iteration: number,
	totalIterations: number,
	currentTask?: string,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "iteration_start",
		iteration,
		totalIterations,
		message: currentTask ? `Starting work on: ${currentTask}` : "Iteration started",
	};

	writeProgressEntry(entry);
}

export function logIterationComplete(
	iteration: number,
	totalIterations: number,
	isTaskComplete: boolean,
	taskTitle?: string,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "iteration_complete",
		iteration,
		totalIterations,
		message: isTaskComplete
			? `Iteration completed - task "${taskTitle}" marked as done`
			: "Iteration completed",
		context: { isTaskComplete },
	};

	writeProgressEntry(entry);
}

export function logTaskComplete(
	iteration: number,
	totalIterations: number,
	taskTitle: string,
	taskIndex: number,
	totalTasks: number,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "task_complete",
		iteration,
		totalIterations,
		message: `Task completed: "${taskTitle}"`,
		context: { taskIndex, totalTasks, progress: `${taskIndex + 1}/${totalTasks}` },
	};

	writeProgressEntry(entry);
}

export function logError(
	iteration: number,
	totalIterations: number,
	errorMessage: string,
	errorContext?: Record<string, unknown>,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "error",
		iteration,
		totalIterations,
		message: `Error: ${errorMessage}`,
		context: errorContext,
	};

	writeProgressEntry(entry);
}

export function logRetry(
	iteration: number,
	totalIterations: number,
	retryCount: number,
	maxRetries: number,
	delayMs: number,
	reason?: string,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "retry",
		iteration,
		totalIterations,
		message: `Retry ${retryCount}/${maxRetries} scheduled${reason ? `: ${reason}` : ""}`,
		context: { retryCount, maxRetries, delayMs },
	};

	writeProgressEntry(entry);
}

export function logSessionComplete(
	projectName: string,
	totalIterations: number,
	totalTasks: number,
	elapsedTimeSeconds: number,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "session_complete",
		iteration: totalIterations,
		totalIterations,
		message: `All tasks completed for project "${projectName}"`,
		context: { totalTasks, elapsedTimeSeconds },
	};

	writeProgressEntry(entry);

	const summary: SessionSummary = {
		projectName,
		startedAt: "",
		lastUpdatedAt: formatTimestamp(),
		totalIterations,
		completedIterations: totalIterations,
		tasksCompleted: totalTasks,
		totalTasks,
		status: "Completed",
	};

	updateSessionSummaryInFile(summary);
}

export function logSessionStopped(
	projectName: string,
	currentIteration: number,
	totalIterations: number,
	reason: string,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "session_stopped",
		iteration: currentIteration,
		totalIterations,
		message: `Session stopped: ${reason}`,
	};

	writeProgressEntry(entry);

	const summary: SessionSummary = {
		projectName,
		startedAt: "",
		lastUpdatedAt: formatTimestamp(),
		totalIterations,
		completedIterations: currentIteration,
		tasksCompleted: 0,
		totalTasks: 0,
		status: "Stopped",
	};

	updateSessionSummaryInFile(summary);
}

export function logMaxIterationsReached(
	projectName: string,
	totalIterations: number,
	completedTasks: number,
	totalTasks: number,
): void {
	const entry: ProgressEntry = {
		timestamp: formatTimestamp(),
		type: "max_iterations",
		iteration: totalIterations,
		totalIterations,
		message: `Maximum iterations (${totalIterations}) reached. ${completedTasks}/${totalTasks} tasks completed.`,
	};

	writeProgressEntry(entry);

	const summary: SessionSummary = {
		projectName,
		startedAt: "",
		lastUpdatedAt: formatTimestamp(),
		totalIterations,
		completedIterations: totalIterations,
		tasksCompleted: completedTasks,
		totalTasks,
		status: "Max Iterations Reached",
	};

	updateSessionSummaryInFile(summary);
}

export function readProgressFile(): string | null {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		return null;
	}
	try {
		return readFileSync(PROGRESS_FILE_PATH, "utf-8");
	} catch {
		return null;
	}
}
