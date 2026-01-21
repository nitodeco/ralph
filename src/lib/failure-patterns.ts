import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { analyzeFailure } from "@/lib/failure-analyzer.ts";
import { ensureProjectDirExists, getFailureHistoryFilePath } from "@/lib/paths.ts";
import { isFailureHistory } from "@/lib/type-guards.ts";
import type {
	FailureHistory,
	FailureHistoryEntry,
	FailurePattern,
	PromptGuardrail,
} from "@/types.ts";

const MAX_FAILURE_HISTORY_ENTRIES = 100;
const PATTERN_THRESHOLD = 3;

function createEmptyFailureHistory(): FailureHistory {
	return {
		entries: [],
		patterns: [],
		lastAnalyzedAt: null,
	};
}

export function loadFailureHistory(): FailureHistory {
	const failureHistoryFilePath = getFailureHistoryFilePath();

	if (!existsSync(failureHistoryFilePath)) {
		return createEmptyFailureHistory();
	}

	try {
		const content = readFileSync(failureHistoryFilePath, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isFailureHistory(parsed)) {
			return createEmptyFailureHistory();
		}

		return {
			entries: parsed.entries ?? [],
			patterns: parsed.patterns ?? [],
			lastAnalyzedAt: parsed.lastAnalyzedAt ?? null,
		};
	} catch {
		return createEmptyFailureHistory();
	}
}

export function saveFailureHistory(history: FailureHistory): void {
	ensureProjectDirExists();
	writeFileSync(getFailureHistoryFilePath(), JSON.stringify(history, null, "\t"), "utf-8");
}

export interface RecordFailureOptions {
	error: string;
	output: string;
	taskTitle: string;
	exitCode: number | null;
	iteration: number;
}

export function recordFailure(options: RecordFailureOptions): FailureHistoryEntry {
	const history = loadFailureHistory();
	const analysis = analyzeFailure(options.error, options.output, options.exitCode);

	const entry: FailureHistoryEntry = {
		timestamp: new Date().toISOString(),
		error: options.error,
		taskTitle: options.taskTitle,
		category: analysis.category,
		rootCause: analysis.rootCause,
		exitCode: options.exitCode,
		iteration: options.iteration,
	};

	history.entries.push(entry);

	if (history.entries.length > MAX_FAILURE_HISTORY_ENTRIES) {
		history.entries = history.entries.slice(-MAX_FAILURE_HISTORY_ENTRIES);
	}

	saveFailureHistory(history);

	return entry;
}

function normalizeErrorForPattern(error: string): string {
	return error
		.toLowerCase()
		.replace(/\d+/g, "N")
		.replace(/['"`].*?['"`]/g, '"..."')
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 200);
}

function calculateStringSimilarity(stringA: string, stringB: string): number {
	const setA = new Set(stringA.split(" "));
	const setB = new Set(stringB.split(" "));
	const intersection = new Set([...setA].filter((word) => setB.has(word)));
	const union = new Set([...setA, ...setB]);

	return intersection.size / union.size;
}

function groupEntriesByPattern(entries: FailureHistoryEntry[]): Map<string, FailureHistoryEntry[]> {
	const groups = new Map<string, FailureHistoryEntry[]>();
	const processedIndices = new Set<number>();

	for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
		if (processedIndices.has(entryIndex)) {
			continue;
		}

		const entry = entries.at(entryIndex);

		if (!entry) {
			continue;
		}

		const normalizedError = normalizeErrorForPattern(entry.error);
		const groupKey = `${entry.category}:${normalizedError}`;

		const group: FailureHistoryEntry[] = [entry];

		processedIndices.add(entryIndex);

		for (
			let comparisonIndex = entryIndex + 1;
			comparisonIndex < entries.length;
			comparisonIndex++
		) {
			if (processedIndices.has(comparisonIndex)) {
				continue;
			}

			const otherEntry = entries.at(comparisonIndex);

			if (!otherEntry) {
				continue;
			}

			if (otherEntry.category !== entry.category) {
				continue;
			}

			const otherNormalized = normalizeErrorForPattern(otherEntry.error);
			const similarity = calculateStringSimilarity(normalizedError, otherNormalized);

			if (similarity > 0.7) {
				group.push(otherEntry);
				processedIndices.add(comparisonIndex);
			}
		}

		groups.set(groupKey, group);
	}

	return groups;
}

function generateGuardrailSuggestion(category: string, entries: FailureHistoryEntry[]): string {
	const categoryGuardrails: Record<string, string> = {
		build_failure: "Always run the build command and fix any errors before committing changes",
		test_failure: "Run the test suite after making changes and ensure all tests pass",
		lint_error: "Run the linter before committing and fix all style issues",
		permission_error: "Verify file permissions before attempting to modify files",
		timeout: "Break large tasks into smaller, more focused subtasks",
		stuck: "Use incremental changes with frequent saves to avoid getting stuck",
		network_error: "Check network connectivity before operations that require external services",
		syntax_error: "Validate syntax by running the compiler/interpreter after each change",
		dependency_error: "Verify all dependencies are installed before running the project",
		unknown: "Review error messages carefully and address the root cause before proceeding",
	};

	const suggestion = categoryGuardrails[category];

	if (suggestion) {
		return suggestion;
	}

	const commonErrors = entries.map((entry) => entry.rootCause).slice(0, 3);

	return `Address common issue: ${commonErrors[0] || "unknown error"}`;
}

export function analyzePatterns(): FailurePattern[] {
	const history = loadFailureHistory();
	const groups = groupEntriesByPattern(history.entries);
	const patterns: FailurePattern[] = [];

	for (const [_groupKey, entries] of groups) {
		if (entries.length < 2) {
			continue;
		}

		const firstEntry = entries[0];
		const lastEntry = entries[entries.length - 1];

		if (!firstEntry || !lastEntry) {
			continue;
		}

		const affectedTasks = [...new Set(entries.map((entry) => entry.taskTitle))];

		const pattern: FailurePattern = {
			pattern: normalizeErrorForPattern(firstEntry.error),
			category: firstEntry.category,
			occurrences: entries.length,
			firstSeen: firstEntry.timestamp,
			lastSeen: lastEntry.timestamp,
			affectedTasks,
			suggestedGuardrail:
				entries.length >= PATTERN_THRESHOLD
					? generateGuardrailSuggestion(firstEntry.category, entries)
					: null,
			resolved: false,
		};

		patterns.push(pattern);
	}

	patterns.sort((patternA, patternB) => patternB.occurrences - patternA.occurrences);

	history.patterns = patterns;
	history.lastAnalyzedAt = new Date().toISOString();
	saveFailureHistory(history);

	return patterns;
}

export function getSuggestedGuardrails(): PromptGuardrail[] {
	const patterns = analyzePatterns();
	const suggestions: PromptGuardrail[] = [];

	for (const pattern of patterns) {
		if (pattern.occurrences >= PATTERN_THRESHOLD && pattern.suggestedGuardrail) {
			suggestions.push({
				id: `suggested-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
				instruction: pattern.suggestedGuardrail,
				trigger: "always",
				category: pattern.category === "safety" ? "safety" : "quality",
				enabled: false,
				addedAt: new Date().toISOString(),
				addedAfterFailure: `Pattern detected: ${pattern.pattern.slice(0, 50)}... (${pattern.occurrences} occurrences)`,
			});
		}
	}

	return suggestions;
}

export interface PatternReport {
	totalFailures: number;
	uniquePatterns: number;
	topPatterns: FailurePattern[];
	taskFailureRates: Array<{ task: string; failures: number }>;
	categoryBreakdown: Array<{ category: string; count: number; percentage: number }>;
	suggestedGuardrails: PromptGuardrail[];
	recommendations: string[];
	lastAnalyzedAt: string | null;
}

export function generatePatternReport(): PatternReport {
	const history = loadFailureHistory();
	const patterns = analyzePatterns();
	const suggestedGuardrails = getSuggestedGuardrails();

	const taskFailures = new Map<string, number>();
	const categoryCount = new Map<string, number>();

	for (const entry of history.entries) {
		taskFailures.set(entry.taskTitle, (taskFailures.get(entry.taskTitle) ?? 0) + 1);
		categoryCount.set(entry.category, (categoryCount.get(entry.category) ?? 0) + 1);
	}

	const taskFailureRates = [...taskFailures.entries()]
		.map(([task, failures]) => ({ task, failures }))
		.sort((taskA, taskB) => taskB.failures - taskA.failures)
		.slice(0, 10);

	const totalFailures = history.entries.length;
	const categoryBreakdown = [...categoryCount.entries()]
		.map(([category, count]) => ({
			category,
			count,
			percentage: totalFailures > 0 ? Math.round((count / totalFailures) * 100) : 0,
		}))
		.sort((categoryA, categoryB) => categoryB.count - categoryA.count);

	const recommendations: string[] = [];

	const topCategory = categoryBreakdown[0];

	if (topCategory && topCategory.percentage > 40) {
		recommendations.push(
			`${topCategory.category.replace(/_/g, " ")} accounts for ${topCategory.percentage}% of failures. Consider adding specific guardrails for this issue.`,
		);
	}

	const topFailingTask = taskFailureRates[0];

	if (topFailingTask && topFailingTask.failures >= 5) {
		recommendations.push(
			`Task "${topFailingTask.task}" has ${topFailingTask.failures} failures. Consider breaking it into smaller subtasks.`,
		);
	}

	if (suggestedGuardrails.length > 0) {
		recommendations.push(
			`${suggestedGuardrails.length} guardrail(s) suggested based on recurring patterns. Run 'ralph guardrails add' to add them.`,
		);
	}

	if (patterns.filter((pattern) => pattern.occurrences >= PATTERN_THRESHOLD).length === 0) {
		recommendations.push("No significant recurring patterns detected. Keep monitoring for trends.");
	}

	return {
		totalFailures,
		uniquePatterns: patterns.length,
		topPatterns: patterns.slice(0, 10),
		taskFailureRates,
		categoryBreakdown,
		suggestedGuardrails,
		recommendations,
		lastAnalyzedAt: history.lastAnalyzedAt,
	};
}

export function formatPatternReport(report: PatternReport): string {
	const lines: string[] = [];

	lines.push("╭─────────────────────────────────────────────────────────────╮");
	lines.push("│                   Failure Pattern Analysis                  │");
	lines.push("╰─────────────────────────────────────────────────────────────╯");
	lines.push("");

	lines.push(`Total Failures: ${report.totalFailures}`);
	lines.push(`Unique Patterns: ${report.uniquePatterns}`);
	lines.push(`Last Analyzed: ${report.lastAnalyzedAt ?? "Never"}`);
	lines.push("");

	if (report.categoryBreakdown.length > 0) {
		lines.push("─── Category Breakdown ───");

		for (const category of report.categoryBreakdown) {
			const bar = "█".repeat(Math.ceil(category.percentage / 5));

			lines.push(
				`  ${category.category.padEnd(18)} ${bar} ${category.percentage}% (${category.count})`,
			);
		}

		lines.push("");
	}

	if (report.topPatterns.length > 0) {
		lines.push("─── Top Failure Patterns ───");

		for (const [index, pattern] of report.topPatterns.slice(0, 5).entries()) {
			lines.push(`  ${index + 1}. [${pattern.category}] ${pattern.occurrences} occurrences`);
			lines.push(
				`     Pattern: ${pattern.pattern.slice(0, 60)}${pattern.pattern.length > 60 ? "..." : ""}`,
			);
			lines.push(
				`     Tasks: ${pattern.affectedTasks.slice(0, 3).join(", ")}${pattern.affectedTasks.length > 3 ? "..." : ""}`,
			);

			if (pattern.suggestedGuardrail) {
				lines.push(`     Suggested: ${pattern.suggestedGuardrail}`);
			}

			lines.push("");
		}
	}

	if (report.taskFailureRates.length > 0) {
		lines.push("─── Tasks with Most Failures ───");

		for (const task of report.taskFailureRates.slice(0, 5)) {
			lines.push(`  • ${task.task}: ${task.failures} failures`);
		}

		lines.push("");
	}

	if (report.recommendations.length > 0) {
		lines.push("─── Recommendations ───");

		for (const recommendation of report.recommendations) {
			lines.push(`  → ${recommendation}`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

export function clearFailureHistory(): void {
	saveFailureHistory(createEmptyFailureHistory());
}

export function getFailureHistoryStats(): {
	totalEntries: number;
	oldestEntry: string | null;
	newestEntry: string | null;
} {
	const history = loadFailureHistory();
	const firstEntry = history.entries[0];
	const lastEntry = history.entries[history.entries.length - 1];

	return {
		totalEntries: history.entries.length,
		oldestEntry: firstEntry?.timestamp ?? null,
		newestEntry: lastEntry?.timestamp ?? null,
	};
}
