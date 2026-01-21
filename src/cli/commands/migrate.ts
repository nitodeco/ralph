import {
	hasLocalRalphDir,
	removeLocalRalphDir,
} from "@/lib/services/project-registry/migration.ts";

export function handleMigrateCommand(version: string): void {
	console.log(`◆ ralph v${version} - Cleanup\n`);

	if (!hasLocalRalphDir()) {
		console.log("No local .ralph directory found in current directory.");
		console.log("Nothing to clean up.");
		process.exit(0);
	}

	console.log("Removing local .ralph directory...");

	const removed = removeLocalRalphDir();

	if (removed) {
		console.log("\x1b[32m✓\x1b[0m Local .ralph directory removed.");
		console.log("\nRalph now stores all project data in ~/.ralph/projects/");
	} else {
		console.log("\x1b[31m✗\x1b[0m Failed to remove local .ralph directory.");
		process.exit(1);
	}
}

export function printMigrateStatus(): void {
	const hasLocal = hasLocalRalphDir();

	if (!hasLocal) {
		console.log("No local .ralph directory found.");

		return;
	}

	console.log("Local .ralph directory found in this repository.");
	console.log("Run 'ralph migrate' to remove it.");
	console.log("\nNote: Ralph now stores all project data in ~/.ralph/projects/");
}
