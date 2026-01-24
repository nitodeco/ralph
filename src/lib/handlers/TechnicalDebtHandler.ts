import type { IterationLog, SessionStatistics } from "@/types.ts";
import { appendProgress } from "../progress.ts";
import type { Handler, TechnicalDebtStateCallback } from "./types.ts";

export type TechnicalDebtSeverity = "low" | "medium" | "high" | "critical";

export type TechnicalDebtCategory =
	| "retry_patterns"
	| "verification_failures"
	| "decomposition_frequency"
	| "error_patterns"
	| "performance"
	| "process";

export interface TechnicalDebtItem {
	id: string;
	category: TechnicalDebtCategory;
	severity: TechnicalDebtSeverity;
	title: string;
	description: string;
	occurrences: number;
	affectedIterations: number[];
	suggestedAction: string | null;
}

export interface TechnicalDebtReport {
	sessionId: string;
	analyzedAt: string;
	totalItems: number;
	itemsBySeverity: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
	itemsByCategory: Record<TechnicalDebtCategory, number>;
	items: TechnicalDebtItem[];
	summary: string;
	recommendations: string[];
}

export interface TechnicalDebtConfig {
	enabled?: boolean;
	minSeverity?: TechnicalDebtSeverity;
	analyzeRetryPatterns?: boolean;
	analyzeVerificationFailures?: boolean;
	analyzeDecompositions?: boolean;
	analyzeErrorPatterns?: boolean;
	analyzePerformance?: boolean;
}

export interface TechnicalDebtHandlerOptions {
	onStateChange?: TechnicalDebtStateCallback;
}

interface AnalysisInput {
	sessionId: string;
	logs: IterationLog[];
	statistics: SessionStatistics;
	config: TechnicalDebtConfig;
}

const SEVERITY_ORDER_BY_LEVEL: Record<TechnicalDebtSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

const RETRY_THRESHOLD_FOR_HIGH_SEVERITY = 3;
const RETRY_THRESHOLD_FOR_MEDIUM_SEVERITY = 2;
const VERIFICATION_FAILURE_THRESHOLD_FOR_HIGH = 3;
const DECOMPOSITION_RATIO_THRESHOLD_HIGH = 0.5;
const DECOMPOSITION_RATIO_THRESHOLD_MEDIUM = 0.3;
const ERROR_REPETITION_THRESHOLD = 2;
const SLOW_ITERATION_MULTIPLIER = 2;

function generateItemId(category: TechnicalDebtCategory, index: number): string {
	return `${category}-${index}`;
}

function analyzeRetryPatterns(logs: IterationLog[]): TechnicalDebtItem[] {
	const items: TechnicalDebtItem[] = [];
	const highRetryIterations = logs.filter(
		(log) => log.agent.retryCount >= RETRY_THRESHOLD_FOR_HIGH_SEVERITY,
	);
	const mediumRetryIterations = logs.filter(
		(log) =>
			log.agent.retryCount >= RETRY_THRESHOLD_FOR_MEDIUM_SEVERITY &&
			log.agent.retryCount < RETRY_THRESHOLD_FOR_HIGH_SEVERITY,
	);

	if (highRetryIterations.length > 0) {
		const categoryCountByCategory = new Map<string, { count: number; iterations: number[] }>();

		for (const log of highRetryIterations) {
			if (log.agent.retryContexts) {
				for (const ctx of log.agent.retryContexts) {
					const existing = categoryCountByCategory.get(ctx.failureCategory);

					if (existing) {
						existing.count++;

						if (!existing.iterations.includes(log.iteration)) {
							existing.iterations.push(log.iteration);
						}
					} else {
						categoryCountByCategory.set(ctx.failureCategory, {
							count: 1,
							iterations: [log.iteration],
						});
					}
				}
			}
		}

		for (const [category, categoryData] of categoryCountByCategory) {
			items.push({
				id: generateItemId("retry_patterns", items.length),
				category: "retry_patterns",
				severity: categoryData.count >= 3 ? "critical" : "high",
				title: `Recurring ${category} failures`,
				description: `${categoryData.count} retry attempts due to ${category} across ${categoryData.iterations.length} iterations`,
				occurrences: categoryData.count,
				affectedIterations: categoryData.iterations,
				suggestedAction: `Investigate root cause of ${category} failures and add appropriate guardrails`,
			});
		}
	}

	if (mediumRetryIterations.length > 0) {
		items.push({
			id: generateItemId("retry_patterns", items.length),
			category: "retry_patterns",
			severity: "medium",
			title: "Multiple retry attempts",
			description: `${mediumRetryIterations.length} iterations required 2 retries`,
			occurrences: mediumRetryIterations.length,
			affectedIterations: mediumRetryIterations.map((log) => log.iteration),
			suggestedAction: "Review agent prompts and task clarity to reduce retry frequency",
		});
	}

	return items;
}

function analyzeVerificationFailures(logs: IterationLog[]): TechnicalDebtItem[] {
	const items: TechnicalDebtItem[] = [];
	const verificationFailures = logs.filter((log) => log.verification && !log.verification.passed);
	const failedCheckCountByName = new Map<string, { count: number; iterations: number[] }>();

	for (const log of verificationFailures) {
		if (log.verification?.failedChecks) {
			for (const checkName of log.verification.failedChecks) {
				const existing = failedCheckCountByName.get(checkName);

				if (existing) {
					existing.count++;
					existing.iterations.push(log.iteration);
				} else {
					failedCheckCountByName.set(checkName, {
						count: 1,
						iterations: [log.iteration],
					});
				}
			}
		}
	}

	for (const [checkName, checkData] of failedCheckCountByName) {
		const severity: TechnicalDebtSeverity =
			checkData.count >= VERIFICATION_FAILURE_THRESHOLD_FOR_HIGH ? "high" : "medium";

		items.push({
			id: generateItemId("verification_failures", items.length),
			category: "verification_failures",
			severity,
			title: `Recurring ${checkName} verification failure`,
			description: `${checkName} failed ${checkData.count} times across ${checkData.iterations.length} iterations`,
			occurrences: checkData.count,
			affectedIterations: checkData.iterations,
			suggestedAction: `Review ${checkName} check configuration or address underlying code quality issues`,
		});
	}

	return items;
}

function analyzeDecompositions(logs: IterationLog[]): TechnicalDebtItem[] {
	const items: TechnicalDebtItem[] = [];
	const decomposedLogs = logs.filter((log) => log.decomposition !== undefined);
	const decompositionRatio = logs.length > 0 ? decomposedLogs.length / logs.length : 0;

	if (decomposedLogs.length > 0) {
		const severity: TechnicalDebtSeverity =
			decompositionRatio >= DECOMPOSITION_RATIO_THRESHOLD_HIGH
				? "high"
				: decompositionRatio >= DECOMPOSITION_RATIO_THRESHOLD_MEDIUM
					? "medium"
					: "low";

		items.push({
			id: generateItemId("decomposition_frequency", 0),
			category: "decomposition_frequency",
			severity,
			title: "High task decomposition frequency",
			description: `${decomposedLogs.length} of ${logs.length} iterations (${(decompositionRatio * 100).toFixed(1)}%) required task decomposition`,
			occurrences: decomposedLogs.length,
			affectedIterations: decomposedLogs.map((log) => log.iteration),
			suggestedAction:
				"Consider pre-decomposing complex tasks in the PRD to reduce iteration overhead",
		});
	}

	return items;
}

function analyzeErrorPatterns(logs: IterationLog[]): TechnicalDebtItem[] {
	const items: TechnicalDebtItem[] = [];
	const errorMessageCountByMessage = new Map<string, { count: number; iterations: number[] }>();

	for (const log of logs) {
		for (const error of log.errors) {
			const normalizedMessage = error.message.slice(0, 100);
			const existing = errorMessageCountByMessage.get(normalizedMessage);

			if (existing) {
				existing.count++;
				existing.iterations.push(log.iteration);
			} else {
				errorMessageCountByMessage.set(normalizedMessage, {
					count: 1,
					iterations: [log.iteration],
				});
			}
		}
	}

	for (const [errorMessage, errorData] of errorMessageCountByMessage) {
		if (errorData.count >= ERROR_REPETITION_THRESHOLD) {
			items.push({
				id: generateItemId("error_patterns", items.length),
				category: "error_patterns",
				severity: errorData.count >= 4 ? "high" : "medium",
				title: "Recurring error pattern",
				description: `"${errorMessage}..." occurred ${errorData.count} times`,
				occurrences: errorData.count,
				affectedIterations: errorData.iterations,
				suggestedAction: "Investigate and address the root cause of this recurring error",
			});
		}
	}

	return items;
}

function analyzePerformance(
	logs: IterationLog[],
	statistics: SessionStatistics,
): TechnicalDebtItem[] {
	const items: TechnicalDebtItem[] = [];
	const avgDurationMs = statistics.averageDurationMs;
	const slowThresholdMs = avgDurationMs * SLOW_ITERATION_MULTIPLIER;
	const slowIterations = logs.filter(
		(log) => log.durationMs !== null && log.durationMs > slowThresholdMs,
	);

	if (slowIterations.length > 0 && avgDurationMs > 0) {
		const slowRatio = slowIterations.length / logs.length;
		const severity: TechnicalDebtSeverity =
			slowRatio >= 0.3 ? "high" : slowRatio >= 0.15 ? "medium" : "low";

		items.push({
			id: generateItemId("performance", 0),
			category: "performance",
			severity,
			title: "Slow iterations detected",
			description: `${slowIterations.length} iterations took more than ${SLOW_ITERATION_MULTIPLIER}x the average duration`,
			occurrences: slowIterations.length,
			affectedIterations: slowIterations.map((log) => log.iteration),
			suggestedAction:
				"Review task complexity and consider splitting slow tasks into smaller units",
		});
	}

	const lowSuccessRate = statistics.successRate < 70;

	if (lowSuccessRate && statistics.completedIterations > 0) {
		items.push({
			id: generateItemId("process", 0),
			category: "process",
			severity: statistics.successRate < 50 ? "critical" : "high",
			title: "Low overall success rate",
			description: `Session success rate of ${statistics.successRate.toFixed(1)}% is below acceptable threshold`,
			occurrences: statistics.failedIterations,
			affectedIterations: logs.filter((log) => log.status === "failed").map((log) => log.iteration),
			suggestedAction:
				"Review PRD task definitions, verification configuration, and agent settings",
		});
	}

	return items;
}

function filterBySeverity(
	items: TechnicalDebtItem[],
	minSeverity: TechnicalDebtSeverity,
): TechnicalDebtItem[] {
	const minLevel = SEVERITY_ORDER_BY_LEVEL[minSeverity];

	return items.filter((item) => SEVERITY_ORDER_BY_LEVEL[item.severity] <= minLevel);
}

function generateSummary(items: TechnicalDebtItem[]): string {
	if (items.length === 0) {
		return "No significant technical debt detected in this session.";
	}

	const criticalCount = items.filter((item) => item.severity === "critical").length;
	const highCount = items.filter((item) => item.severity === "high").length;

	const parts: string[] = [];

	if (criticalCount > 0) {
		parts.push(`${criticalCount} critical`);
	}

	if (highCount > 0) {
		parts.push(`${highCount} high priority`);
	}

	const otherCount = items.length - criticalCount - highCount;

	if (otherCount > 0) {
		parts.push(`${otherCount} other`);
	}

	return `Found ${items.length} technical debt items: ${parts.join(", ")}`;
}

function generateRecommendations(items: TechnicalDebtItem[]): string[] {
	const recommendations: string[] = [];
	const criticalItems = items.filter((item) => item.severity === "critical");
	const highItems = items.filter((item) => item.severity === "high");

	for (const item of criticalItems) {
		if (item.suggestedAction) {
			recommendations.push(`[CRITICAL] ${item.suggestedAction}`);
		}
	}

	for (const item of highItems) {
		if (item.suggestedAction) {
			recommendations.push(`[HIGH] ${item.suggestedAction}`);
		}
	}

	if (recommendations.length === 0 && items.length > 0) {
		recommendations.push("Review the technical debt items and address them based on priority");
	}

	return recommendations;
}

function countItemsByCategory(items: TechnicalDebtItem[]): Record<TechnicalDebtCategory, number> {
	const countByCategory: Record<TechnicalDebtCategory, number> = {
		retry_patterns: 0,
		verification_failures: 0,
		decomposition_frequency: 0,
		error_patterns: 0,
		performance: 0,
		process: 0,
	};

	for (const item of items) {
		countByCategory[item.category]++;
	}

	return countByCategory;
}

function runAnalysis(input: AnalysisInput): TechnicalDebtReport {
	const { sessionId, logs, statistics, config } = input;
	const allItems: TechnicalDebtItem[] = [];

	if (config.analyzeRetryPatterns !== false) {
		allItems.push(...analyzeRetryPatterns(logs));
	}

	if (config.analyzeVerificationFailures !== false) {
		allItems.push(...analyzeVerificationFailures(logs));
	}

	if (config.analyzeDecompositions !== false) {
		allItems.push(...analyzeDecompositions(logs));
	}

	if (config.analyzeErrorPatterns !== false) {
		allItems.push(...analyzeErrorPatterns(logs));
	}

	if (config.analyzePerformance !== false) {
		allItems.push(...analyzePerformance(logs, statistics));
	}

	const filteredItems = config.minSeverity
		? filterBySeverity(allItems, config.minSeverity)
		: allItems;

	filteredItems.sort(
		(a, b) => SEVERITY_ORDER_BY_LEVEL[a.severity] - SEVERITY_ORDER_BY_LEVEL[b.severity],
	);

	return {
		sessionId,
		analyzedAt: new Date().toISOString(),
		totalItems: filteredItems.length,
		itemsBySeverity: {
			critical: filteredItems.filter((item) => item.severity === "critical").length,
			high: filteredItems.filter((item) => item.severity === "high").length,
			medium: filteredItems.filter((item) => item.severity === "medium").length,
			low: filteredItems.filter((item) => item.severity === "low").length,
		},
		itemsByCategory: countItemsByCategory(filteredItems),
		items: filteredItems,
		summary: generateSummary(filteredItems),
		recommendations: generateRecommendations(filteredItems),
	};
}

export function formatTechnicalDebtReport(report: TechnicalDebtReport): string {
	const lines: string[] = ["", "=== Technical Debt Review ===", report.summary, ""];

	if (report.items.length > 0) {
		lines.push("Items by severity:");
		lines.push(`  Critical: ${report.itemsBySeverity.critical}`);
		lines.push(`  High: ${report.itemsBySeverity.high}`);
		lines.push(`  Medium: ${report.itemsBySeverity.medium}`);
		lines.push(`  Low: ${report.itemsBySeverity.low}`);
		lines.push("");

		const topItems = report.items.slice(0, 5);

		lines.push("Top items:");

		for (const item of topItems) {
			lines.push(`  [${item.severity.toUpperCase()}] ${item.title}`);
			lines.push(`    ${item.description}`);

			if (item.suggestedAction) {
				lines.push(`    Action: ${item.suggestedAction}`);
			}
		}

		lines.push("");

		if (report.recommendations.length > 0) {
			lines.push("Recommendations:");

			for (const rec of report.recommendations) {
				lines.push(`  - ${rec}`);
			}

			lines.push("");
		}
	}

	return lines.join("\n");
}

export class TechnicalDebtHandler implements Handler {
	private lastReport: TechnicalDebtReport | null = null;
	private isRunning = false;
	private onStateChange?: TechnicalDebtStateCallback;

	constructor(options: TechnicalDebtHandlerOptions = {}) {
		this.onStateChange = options.onStateChange;
	}

	reset(): void {
		this.lastReport = null;
		this.isRunning = false;
	}

	getLastReport(): TechnicalDebtReport | null {
		return this.lastReport;
	}

	getIsRunning(): boolean {
		return this.isRunning;
	}

	run(
		sessionId: string,
		logs: IterationLog[],
		statistics: SessionStatistics,
		config: TechnicalDebtConfig = {},
	): TechnicalDebtReport {
		this.isRunning = true;
		this.onStateChange?.(true, null);

		const report = runAnalysis({
			sessionId,
			logs,
			statistics,
			config,
		});

		this.lastReport = report;
		this.isRunning = false;
		this.onStateChange?.(false, report);

		if (report.items.length > 0) {
			appendProgress(formatTechnicalDebtReport(report));
		}

		return report;
	}
}
