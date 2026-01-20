import { loadSession } from "@/lib/session.ts";
import { calculateStatisticsFromLogs, displayStatisticsReport } from "@/lib/statistics.ts";

export function printStats(version: string): void {
	console.log(`◆ ralph v${version} - Statistics\n`);

	const session = loadSession();
	if (!session) {
		console.log("No session data found.");
		console.log("\nRun 'ralph' or 'ralph -b' to start a new session.");
		return;
	}

	const statistics = calculateStatisticsFromLogs(session);
	displayStatisticsReport(statistics);
}
