import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Prd, PrdTask } from "@/types.ts";
import { formatTimestamp } from "./logging-utils.ts";
import { getArchiveDir } from "./paths.ts";
import { findPrdFile, loadPrd, savePrd } from "./prd.ts";
import { getProgressFilePath } from "./progress.ts";

interface ArchivedTasks {
	archivedAt: string;
	project: string;
	tasks: PrdTask[];
}

export function ensureArchiveDirExists(): void {
	const archiveDir = getArchiveDir();

	if (!existsSync(archiveDir)) {
		mkdirSync(archiveDir, { recursive: true });
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
	const archivePath = join(getArchiveDir(), archiveFileName);

	writeFileSync(archivePath, JSON.stringify(archiveData, null, 2));

	const pendingTasks = prd.tasks.filter((task) => !task.done);
	const updatedPrd: Prd = {
		...prd,
		tasks: pendingTasks,
	};

	return updatedPrd;
}

export function archiveProgressFile(): void {
	const progressFilePath = getProgressFilePath();

	if (!existsSync(progressFilePath)) {
		return;
	}

	ensureArchiveDirExists();

	const archiveFileName = `progress-${generateArchiveTimestamp()}.txt`;
	const archivePath = join(getArchiveDir(), archiveFileName);

	renameSync(progressFilePath, archivePath);
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

	const progressFilePath = getProgressFilePath();

	if (existsSync(progressFilePath)) {
		archiveProgressFile();
		result.progressArchived = true;
	}

	return result;
}
