import {
	hasLocalRalphDir,
	migrateLocalRalphDir,
	needsProjectMigration,
	removeLocalRalphDir,
} from "@/lib/services/project-registry/migration.ts";

export function handleMigrateCommand(version: string, shouldRemoveLocal: boolean = false): void {
	console.log(`◆ ralph v${version} - Migrate\n`);

	if (!hasLocalRalphDir()) {
		console.log("No local .ralph directory found in current directory.");
		console.log("Nothing to migrate.");
		process.exit(0);
	}

	if (!needsProjectMigration()) {
		console.log("This project is already registered in global storage.");
		console.log("No migration needed.");
		process.exit(0);
	}

	console.log("Migrating local .ralph directory to global storage...\n");

	const result = migrateLocalRalphDir();

	if (result.success && result.identifier) {
		console.log("\x1b[32m✓\x1b[0m Migration successful!\n");
		console.log(`  Project: ${result.identifier.folderName}`);
		console.log(`  Source: ${result.sourcePath}`);
		console.log(`  Destination: ${result.destinationPath}\n`);

		if (result.migratedFiles.length > 0) {
			console.log("  Migrated files:");

			for (const file of result.migratedFiles) {
				console.log(`    - ${file}`);
			}
		}

		if (shouldRemoveLocal) {
			console.log("\nRemoving local .ralph directory...");
			const removed = removeLocalRalphDir();

			if (removed) {
				console.log("\x1b[32m✓\x1b[0m Local .ralph directory removed.");
			} else {
				console.log("\x1b[33m!\x1b[0m Failed to remove local .ralph directory.");
			}
		} else {
			console.log("\n\x1b[33mNote:\x1b[0m Local .ralph directory was kept as a backup.");
			console.log("You can safely delete it manually or run 'ralph migrate --remove' next time.");
		}
	} else {
		console.error("\x1b[31m✗\x1b[0m Migration failed.\n");

		if (result.errors.length > 0) {
			console.error("  Errors:");

			for (const error of result.errors) {
				console.error(`    - ${error}`);
			}
		}

		if (result.migratedFiles.length > 0) {
			console.log("\n  Partially migrated files:");

			for (const file of result.migratedFiles) {
				console.log(`    - ${file}`);
			}
		}

		process.exit(1);
	}
}

export function printMigrateStatus(): void {
	const hasLocal = hasLocalRalphDir();
	const needsMigration = needsProjectMigration();

	if (!hasLocal) {
		console.log("No local .ralph directory found.");

		return;
	}

	if (needsMigration) {
		console.log(
			"Migration needed: Local .ralph directory found but project not in global registry.",
		);
		console.log("Run 'ralph migrate' to migrate to global storage.");
	} else {
		console.log("Project is already in global storage.");
		console.log("Local .ralph directory can be safely deleted.");
	}
}
