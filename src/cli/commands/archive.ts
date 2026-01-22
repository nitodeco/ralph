import { performSessionArchive } from "@/lib/archive.ts";

export function printArchive(version: string): void {
	console.log(`◆ ralph v${version} - Archive\n`);

	const archiveResult = performSessionArchive();

	if (archiveResult.tasksArchived === 0 && !archiveResult.progressArchived) {
		console.log("Nothing to archive.");
		console.log("\nCompleted tasks and progress files are archived when:");
		console.log("  - Tasks are marked as done in the PRD");
		console.log("  - A progress.txt file exists in .ralph/");

		return;
	}

	if (archiveResult.tasksArchived > 0) {
		console.log(
			`Archived ${archiveResult.tasksArchived} completed task${archiveResult.tasksArchived === 1 ? "" : "s"}`,
		);
	}

	if (archiveResult.progressArchived) {
		console.log("Archived progress file");
	}

	console.log("\nArchived files are stored in .ralph/archive/");
}
