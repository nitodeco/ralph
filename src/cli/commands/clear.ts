import * as readline from "node:readline";
import { performSessionArchive } from "@/lib/archive.ts";
import { getSessionService } from "@/lib/services/index.ts";

function executeClear(): void {
	const archiveResult = performSessionArchive();

	if (archiveResult.tasksArchived > 0) {
		console.log(
			`Archived ${archiveResult.tasksArchived} completed task${archiveResult.tasksArchived === 1 ? "" : "s"}`,
		);
	}

	if (archiveResult.progressArchived) {
		console.log("Archived progress file");
	}

	getSessionService().delete();
	console.log("Cleared session data");

	console.log("\nSession cleared successfully. Run 'ralph' to start fresh.");
}

export function printClear(version: string, force: boolean): void {
	console.log(`◆ ralph v${version} - Clear Session\n`);

	if (force) {
		executeClear();

		return;
	}

	console.log("This will:");
	console.log("  • Archive completed tasks and progress");
	console.log("  • Delete the current session data");
	console.log("  • Reset the session state\n");

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question("\x1b[31mAre you sure you want to clear the session? (y/N): \x1b[0m", (answer) => {
		rl.close();

		const isConfirmed = answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";

		if (isConfirmed) {
			executeClear();
		} else {
			console.log("\nClear cancelled.");
		}
	});
}
