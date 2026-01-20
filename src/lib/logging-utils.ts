import { existsSync, renameSync, statSync } from "node:fs";

export function formatTimestamp(): string {
	return new Date().toISOString();
}

export function rotateFile(filePath: string, maxBackupFiles: number): void {
	if (!existsSync(filePath)) {
		return;
	}

	for (let backupIndex = maxBackupFiles - 1; backupIndex >= 0; backupIndex--) {
		const currentBackup = backupIndex === 0 ? filePath : `${filePath}.${backupIndex}`;
		const nextBackup = `${filePath}.${backupIndex + 1}`;

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

export function checkAndRotateFile(
	filePath: string,
	maxFileSizeBytes: number,
	maxBackupFiles: number,
): void {
	if (!existsSync(filePath)) {
		return;
	}

	try {
		const stats = statSync(filePath);

		if (stats.size >= maxFileSizeBytes) {
			rotateFile(filePath, maxBackupFiles);
		}
	} catch {}
}
