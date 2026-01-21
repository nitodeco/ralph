import { cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { LOCAL_RALPH_DIR } from "@/lib/paths.ts";
import { getProjectRegistryService } from "../container.ts";
import type { ProjectIdentifier } from "./types.ts";

export interface MigrationResult {
	success: boolean;
	identifier: ProjectIdentifier | null;
	migratedFiles: string[];
	errors: string[];
	sourcePath: string;
	destinationPath: string | null;
}

function getFilesToMigrate(localRalphDir: string): string[] {
	if (!existsSync(localRalphDir)) {
		return [];
	}

	const files: string[] = [];
	const entries = readdirSync(localRalphDir);

	for (const entry of entries) {
		if (entry === ".gitignore") {
			continue;
		}

		const entryPath = join(localRalphDir, entry);
		const stat = statSync(entryPath);

		if (stat.isFile() || stat.isDirectory()) {
			files.push(entry);
		}
	}

	return files;
}

export function hasLocalRalphDir(cwd: string = process.cwd()): boolean {
	const localRalphPath = join(cwd, LOCAL_RALPH_DIR);

	return existsSync(localRalphPath);
}

export function needsProjectMigration(cwd: string = process.cwd()): boolean {
	if (!hasLocalRalphDir(cwd)) {
		return false;
	}

	const projectRegistryService = getProjectRegistryService();
	const isInitialized = projectRegistryService.isProjectInitialized(cwd);

	return !isInitialized;
}

export function migrateLocalRalphDir(cwd: string = process.cwd()): MigrationResult {
	const localRalphPath = join(cwd, LOCAL_RALPH_DIR);
	const result: MigrationResult = {
		success: false,
		identifier: null,
		migratedFiles: [],
		errors: [],
		sourcePath: localRalphPath,
		destinationPath: null,
	};

	if (!existsSync(localRalphPath)) {
		result.errors.push(`Local .ralph directory not found at ${localRalphPath}`);

		return result;
	}

	const filesToMigrate = getFilesToMigrate(localRalphPath);

	if (filesToMigrate.length === 0) {
		result.errors.push("No files to migrate in local .ralph directory");

		return result;
	}

	const projectRegistryService = getProjectRegistryService();

	try {
		const identifier = projectRegistryService.registerProject(cwd);

		result.identifier = identifier;

		const destinationPath = projectRegistryService.getProjectDir(identifier);

		if (!destinationPath) {
			result.errors.push("Failed to get project directory path");

			return result;
		}

		result.destinationPath = destinationPath;

		for (const file of filesToMigrate) {
			const sourcePath = join(localRalphPath, file);
			const destPath = join(destinationPath, file);

			try {
				const stat = statSync(sourcePath);

				if (stat.isDirectory()) {
					cpSync(sourcePath, destPath, { recursive: true });
				} else {
					cpSync(sourcePath, destPath);
				}

				result.migratedFiles.push(file);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Unknown error";

				result.errors.push(`Failed to migrate ${file}: ${message}`);
			}
		}

		result.success = result.migratedFiles.length > 0 && result.errors.length === 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";

		result.errors.push(`Failed to register project: ${message}`);
	}

	return result;
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
