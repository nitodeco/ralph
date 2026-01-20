import { performSessionArchive } from "@/lib/archive.ts";
import { deleteSession } from "@/lib/session.ts";

export function printClear(version: string): void {
	console.log(`◆ ralph v${version} - Clear Session\n`);

	const archiveResult = performSessionArchive();

	if (archiveResult.tasksArchived > 0) {
		console.log(
			`Archived ${archiveResult.tasksArchived} completed task${archiveResult.tasksArchived === 1 ? "" : "s"}`,
		);
	}

	if (archiveResult.progressArchived) {
		console.log("Archived progress file");
	}

	deleteSession();
	console.log("Cleared session data");

	console.log("\nSession cleared successfully. Run 'ralph' to start fresh.");
}
