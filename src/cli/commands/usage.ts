import { getUsageStatisticsService } from "@/lib/services/index.ts";

export function printUsage(json: boolean): void {
	const usageStatisticsService = getUsageStatisticsService();

	if (!usageStatisticsService.exists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No usage statistics found" }));
		} else {
			console.log(
				"No usage statistics found. Statistics are recorded automatically after sessions.",
			);
		}

		return;
	}

	if (json) {
		const statistics = usageStatisticsService.get();

		console.log(JSON.stringify(statistics, null, 2));

		return;
	}

	const display = usageStatisticsService.formatForDisplay();

	console.log(display);
}

export function printUsageSummary(json: boolean): void {
	const usageStatisticsService = getUsageStatisticsService();

	if (!usageStatisticsService.exists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No usage statistics found" }));
		} else {
			console.log(
				"No usage statistics found. Statistics are recorded automatically after sessions.",
			);
		}

		return;
	}

	const summary = usageStatisticsService.getSummary();

	if (json) {
		console.log(JSON.stringify(summary, null, 2));

		return;
	}

	console.log("=== Usage Summary ===\n");
	console.log(`Total Sessions: ${summary.totalSessions}`);
	console.log(`Total Iterations: ${summary.totalIterations}`);
	console.log(`Tasks Completed: ${summary.totalTasksCompleted}`);
	console.log(`Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`);

	if (summary.streakDays > 0) {
		console.log(`Current Streak: ${summary.streakDays} day${summary.streakDays > 1 ? "s" : ""}`);
	}

	if (summary.lastSessionAt) {
		console.log(`Last Session: ${new Date(summary.lastSessionAt).toLocaleString()}`);
	}
}

export function printRecentSessions(limit: number, json: boolean): void {
	const usageStatisticsService = getUsageStatisticsService();

	if (!usageStatisticsService.exists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No usage statistics found" }));
		} else {
			console.log(
				"No usage statistics found. Statistics are recorded automatically after sessions.",
			);
		}

		return;
	}

	const recentSessions = usageStatisticsService.getRecentSessions(limit);

	if (json) {
		console.log(JSON.stringify(recentSessions, null, 2));

		return;
	}

	if (recentSessions.length === 0) {
		console.log("No sessions recorded yet.");

		return;
	}

	console.log(`=== Recent Sessions (Last ${recentSessions.length}) ===\n`);

	for (const session of recentSessions) {
		const date = new Date(session.startedAt).toLocaleString();
		const durationMinutes = Math.floor(session.durationMs / 60_000);
		const durationSeconds = Math.floor((session.durationMs % 60_000) / 1_000);
		const statusIcon =
			session.status === "completed" ? "✓" : session.status === "stopped" ? "⏹" : "✗";

		console.log(`${statusIcon} ${date}`);
		console.log(`  Duration: ${durationMinutes}m ${durationSeconds}s`);
		console.log(
			`  Iterations: ${session.completedIterations}/${session.totalIterations} (${session.successfulIterations} successful, ${session.failedIterations} failed)`,
		);
		console.log(
			`  Tasks: ${session.tasksCompleted} completed of ${session.tasksAttempted} attempted`,
		);
		console.log();
	}
}

export function printDailyUsage(days: number, json: boolean): void {
	const usageStatisticsService = getUsageStatisticsService();

	if (!usageStatisticsService.exists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No usage statistics found" }));
		} else {
			console.log(
				"No usage statistics found. Statistics are recorded automatically after sessions.",
			);
		}

		return;
	}

	const dailyUsage = usageStatisticsService.getDailyUsage(days);

	if (json) {
		console.log(JSON.stringify(dailyUsage, null, 2));

		return;
	}

	if (dailyUsage.length === 0) {
		console.log("No daily usage recorded yet.");

		return;
	}

	console.log(`=== Daily Usage (Last ${dailyUsage.length} days) ===\n`);

	for (const day of dailyUsage) {
		const durationMinutes = Math.floor(day.totalDurationMs / 60_000);

		console.log(`${day.date}:`);
		console.log(`  Sessions: ${day.sessionsStarted}`);
		console.log(`  Iterations: ${day.iterationsRun}`);
		console.log(`  Tasks Completed: ${day.tasksCompleted}`);
		console.log(`  Total Time: ${durationMinutes} minutes`);
		console.log();
	}
}
