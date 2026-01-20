import type { Session, SessionStatistics } from "@/types.ts";
import { getAllIterationLogs } from "./iteration-logs.ts";
import { appendProgress } from "./progress.ts";

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}

export function generateStatisticsReport(statistics: SessionStatistics): string {
	const {
		totalIterations,
		completedIterations,
		successfulIterations,
		failedIterations,
		totalDurationMs,
		averageDurationMs,
		successRate,
	} = statistics;

	const report = [
		"",
		"=== Session Statistics ===",
		`Total Iterations: ${totalIterations}`,
		`Completed Iterations: ${completedIterations}`,
		`Successful Iterations: ${successfulIterations}`,
		`Failed Iterations: ${failedIterations}`,
		`Success Rate: ${successRate.toFixed(1)}%`,
		`Total Duration: ${formatDuration(totalDurationMs)}`,
		`Average Iteration Duration: ${formatDuration(averageDurationMs)}`,
		"",
	];

	if (statistics.iterationTimings.length > 0) {
		report.push("Iteration Timings:");
		for (const timing of statistics.iterationTimings) {
			if (timing.durationMs !== null) {
				report.push(`  Iteration ${timing.iteration}: ${formatDuration(timing.durationMs)}`);
			}
		}
		report.push("");
	}

	return report.join("\n");
}

export function logStatisticsToProgress(statistics: SessionStatistics): void {
	const report = generateStatisticsReport(statistics);
	appendProgress(report);
}

export function displayStatisticsReport(statistics: SessionStatistics): void {
	const report = generateStatisticsReport(statistics);
	console.log(report);
}

export function printStatisticsReport(session: Session | null): void {
	if (!session) {
		console.log("No session data available.");
		return;
	}
	const report = generateStatisticsReport(session.statistics);
	console.log(report);
}

export function calculateStatisticsFromLogs(session: Session): SessionStatistics {
	const logs = getAllIterationLogs();
	const completedLogs = logs.filter((log) => log.status === "completed" || log.status === "failed");

	const completedIterations = completedLogs.length;
	const successfulIterations = completedLogs.filter(
		(log) => log.status === "completed" && log.task?.wasCompleted,
	).length;
	const failedIterations = completedLogs.filter((log) => log.status === "failed").length;

	const totalDurationMs = completedLogs.reduce((sum, log) => sum + (log.durationMs ?? 0), 0);
	const averageDurationMs = completedIterations > 0 ? totalDurationMs / completedIterations : 0;
	const successRate =
		completedIterations > 0 ? (successfulIterations / completedIterations) * 100 : 0;

	const iterationTimings = completedLogs.map((log) => ({
		iteration: log.iteration,
		startTime: new Date(log.startedAt).getTime(),
		endTime: log.completedAt ? new Date(log.completedAt).getTime() : null,
		durationMs: log.durationMs,
	}));

	return {
		totalIterations: session.statistics.totalIterations,
		completedIterations,
		successfulIterations,
		failedIterations,
		totalDurationMs,
		averageDurationMs,
		successRate,
		iterationTimings,
	};
}
