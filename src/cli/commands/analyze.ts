import {
	clearFailureHistory,
	formatPatternReport,
	generatePatternReport,
	getFailureHistoryStats,
} from "@/lib/failure-patterns.ts";
import {
	formatTechnicalDebtReport,
	TechnicalDebtHandler,
} from "@/lib/handlers/TechnicalDebtHandler.ts";
import { getAllIterationLogs } from "@/lib/iteration-logs.ts";
import type { SessionStatistics } from "@/types.ts";

export function printAnalyze(json: boolean): void {
	const report = generatePatternReport();

	if (json) {
		console.log(JSON.stringify(report, null, 2));

		return;
	}

	console.log(formatPatternReport(report));
}

export function handleAnalyzeExport(): void {
	const report = generatePatternReport();

	console.log(JSON.stringify(report, null, 2));
}

export function handleAnalyzeClear(): void {
	const stats = getFailureHistoryStats();

	if (stats.totalEntries === 0) {
		console.log("No failure history to clear.");

		return;
	}

	clearFailureHistory();
	console.log(`Cleared ${stats.totalEntries} failure history entries.`);
}

export function handleAnalyzeDebt(json: boolean): void {
	const logs = getAllIterationLogs();

	if (logs.length === 0) {
		if (json) {
			console.log(JSON.stringify({ error: "No iteration logs found" }));
		} else {
			console.log("No iteration logs found. Run a session first to generate logs.");
		}

		return;
	}

	const completedLogs = logs.filter((log) => log.status === "completed" || log.status === "failed");
	const successfulIterations = completedLogs.filter(
		(log) => log.status === "completed" && log.task?.wasCompleted,
	).length;
	const failedIterations = completedLogs.filter((log) => log.status === "failed").length;
	const totalDurationMs = completedLogs.reduce((sum, log) => sum + (log.durationMs ?? 0), 0);
	const averageDurationMs = completedLogs.length > 0 ? totalDurationMs / completedLogs.length : 0;
	const successRate =
		completedLogs.length > 0 ? (successfulIterations / completedLogs.length) * 100 : 0;

	const statistics: SessionStatistics = {
		totalIterations: logs.length,
		completedIterations: completedLogs.length,
		successfulIterations,
		failedIterations,
		totalDurationMs,
		averageDurationMs,
		successRate,
		iterationTimings: completedLogs.map((log) => ({
			iteration: log.iteration,
			startTime: new Date(log.startedAt).getTime(),
			endTime: log.completedAt ? new Date(log.completedAt).getTime() : null,
			durationMs: log.durationMs,
		})),
	};

	const handler = new TechnicalDebtHandler();
	const report = handler.run("cli-analysis", logs, statistics);

	if (json) {
		console.log(JSON.stringify(report, null, 2));

		return;
	}

	if (report.totalItems === 0) {
		console.log("No technical debt detected in the iteration logs.");

		return;
	}

	console.log(formatTechnicalDebtReport(report));
}
