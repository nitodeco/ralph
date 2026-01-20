import {
	clearFailureHistory,
	formatPatternReport,
	generatePatternReport,
	getFailureHistoryStats,
} from "@/lib/failure-patterns.ts";

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
