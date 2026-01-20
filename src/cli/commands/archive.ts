import { performSessionArchive } from "@/lib/archive.ts";

export function printArchive(version: string): void {
	console.log(`◆ ralph v${version} - Archive\n`);

	const result = performSessionArchive();

	if (result.tasksArchived === 0 && !result.progressArchived) {
		console.log("Nothing to archive.");
		console.log("\nCompleted tasks and progress files are archived when:");
		console.log("  - Tasks are marked as done in the PRD");
		console.log("  - A progress.txt file exists in .ralph/");

		return;
	}

	if (result.tasksArchived > 0) {
		console.log(
			`Archived ${result.tasksArchived} completed task${result.tasksArchived === 1 ? "" : "s"}`,
		);
	}

	if (result.progressArchived) {
		console.log("Archived progress file");
	}

	console.log("\nArchived files are stored in .ralph/archive/");
}
