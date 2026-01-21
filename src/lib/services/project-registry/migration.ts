import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_RALPH_DIR } from "@/lib/paths.ts";
import { getProjectRegistryService, isInitialized } from "../container.ts";

const FILES_TO_MIGRATE = [
	"prd.json",
	"config.json",
	"session.json",
	"session-memory.json",
	"guardrails.json",
	"progress.txt",
	"instructions.md",
	"failure-history.json",
];

export interface MigrationResult {
	migrated: boolean;
	filesMigrated: string[];
	error?: string;
}

export function hasLocalRalphDir(cwd: string = process.cwd()): boolean {
	const localRalphPath = join(cwd, LOCAL_RALPH_DIR);

	return existsSync(localRalphPath);
}

export function removeLocalRalphDir(cwd: string = process.cwd()): boolean {
	const localRalphPath = join(cwd, LOCAL_RALPH_DIR);

	if (!existsSync(localRalphPath)) {
		return false;
	}

	try {
		rmSync(localRalphPath, { recursive: true, force: true });

		return true;
	} catch {
		return false;
	}
}

export function migrateLocalRalphDir(cwd: string = process.cwd()): MigrationResult {
	if (!isInitialized()) {
		return { migrated: false, filesMigrated: [], error: "Services not initialized" };
	}

	const localRalphPath = join(cwd, LOCAL_RALPH_DIR);

	if (!existsSync(localRalphPath)) {
		return { migrated: false, filesMigrated: [] };
	}

	try {
		const projectRegistryService = getProjectRegistryService();

		projectRegistryService.registerProject(cwd);

		const maybeProjectDir = projectRegistryService.getProjectDir();

		if (!maybeProjectDir) {
			return { migrated: false, filesMigrated: [], error: "Could not resolve project directory" };
		}

		if (!existsSync(maybeProjectDir)) {
			mkdirSync(maybeProjectDir, { recursive: true });
		}

		const filesMigrated: string[] = [];

		for (const file of FILES_TO_MIGRATE) {
			const sourcePath = join(localRalphPath, file);
			const destPath = join(maybeProjectDir, file);

			if (existsSync(sourcePath) && !existsSync(destPath)) {
				copyFileSync(sourcePath, destPath);
				filesMigrated.push(file);
			}
		}

		const logsDir = join(localRalphPath, "logs");

		if (existsSync(logsDir) && statSync(logsDir).isDirectory()) {
			const destLogsDir = join(maybeProjectDir, "logs");

			if (!existsSync(destLogsDir)) {
				mkdirSync(destLogsDir, { recursive: true });
			}

			const logFiles = readdirSync(logsDir);

			for (const logFile of logFiles) {
				const sourcePath = join(logsDir, logFile);
				const destPath = join(destLogsDir, logFile);

				if (!existsSync(destPath) && statSync(sourcePath).isFile()) {
					copyFileSync(sourcePath, destPath);
					filesMigrated.push(`logs/${logFile}`);
				}
			}
		}

		rmSync(localRalphPath, { recursive: true, force: true });

		return { migrated: true, filesMigrated };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";

		return { migrated: false, filesMigrated: [], error: message };
	}
}
