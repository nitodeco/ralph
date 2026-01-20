import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Prd, PrdTask } from "@/types.ts";
import { formatTimestamp } from "./logging-utils.ts";
import { RALPH_DIR } from "./paths.ts";
import { findPrdFile, loadPrd, savePrd } from "./prd.ts";
import { PROGRESS_FILE_PATH } from "./progress.ts";

export const ARCHIVE_DIR = join(RALPH_DIR, "archive");

interface ArchivedTasks {
	archivedAt: string;
	project: string;
	tasks: PrdTask[];
}

export function ensureArchiveDirExists(): void {
	if (!existsSync(ARCHIVE_DIR)) {
		mkdirSync(ARCHIVE_DIR, { recursive: true });
	}
}

function generateArchiveTimestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

export function archiveCompletedTasks(prd: Prd): Prd {
	const completedTasks = prd.tasks.filter((task) => task.done);

	if (completedTasks.length === 0) {
		return prd;
	}

	ensureArchiveDirExists();

	const archiveData: ArchivedTasks = {
		archivedAt: formatTimestamp(),
		project: prd.project,
		tasks: completedTasks,
	};

	const archiveFileName = `tasks-${generateArchiveTimestamp()}.json`;
	const archivePath = join(ARCHIVE_DIR, archiveFileName);

	writeFileSync(archivePath, JSON.stringify(archiveData, null, 2));

	const pendingTasks = prd.tasks.filter((task) => !task.done);
	const updatedPrd: Prd = {
		...prd,
		tasks: pendingTasks,
	};

	return updatedPrd;
}

export function archiveProgressFile(): void {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		return;
	}

	ensureArchiveDirExists();

	const archiveFileName = `progress-${generateArchiveTimestamp()}.txt`;
	const archivePath = join(ARCHIVE_DIR, archiveFileName);

	renameSync(PROGRESS_FILE_PATH, archivePath);
}

export interface ArchiveResult {
	tasksArchived: number;
	progressArchived: boolean;
}

export function performSessionArchive(): ArchiveResult {
	const result: ArchiveResult = {
		tasksArchived: 0,
		progressArchived: false,
	};

	const prdFile = findPrdFile();

	if (!prdFile) {
		return result;
	}

	const prd = loadPrd();

	if (!prd) {
		return result;
	}

	const completedTaskCount = prd.tasks.filter((task) => task.done).length;

	if (completedTaskCount > 0) {
		const updatedPrd = archiveCompletedTasks(prd);

		savePrd(updatedPrd);
		result.tasksArchived = completedTaskCount;
	}

	if (existsSync(PROGRESS_FILE_PATH)) {
		archiveProgressFile();
		result.progressArchived = true;
	}

	return result;
}
