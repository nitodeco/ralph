import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "@/lib/idempotency.ts";
import { ensureProjectDirExists, getUsageStatisticsFilePath } from "@/lib/paths.ts";
import type {
  DailyUsage,
  RecordSessionOptions,
  SessionRecord,
  UsageStatistics,
  UsageStatisticsService,
  UsageStatisticsSummary,
} from "./types.ts";
import { USAGE_STATISTICS_CONSTANTS } from "./types.ts";
import { isUsageStatistics } from "./validation.ts";

function createEmptyStatistics(projectName: string): UsageStatistics {
  const now = new Date().toISOString();

  return {
    createdAt: now,
    dailyUsage: [],
    lastUpdatedAt: now,
    lifetime: {
      averageIterationsPerSession: 0,
      averageSessionDurationMs: 0,
      averageTasksPerSession: 0,
      failedIterations: 0,
      overallSuccessRate: 0,
      successfulIterations: 0,
      totalDurationMs: 0,
      totalIterations: 0,
      totalSessions: 0,
      totalTasksAttempted: 0,
      totalTasksCompleted: 0,
    },
    projectName,
    recentSessions: [],
    version: USAGE_STATISTICS_CONSTANTS.VERSION,
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

function getDateString(dateStr: string): string {
  return dateStr.split("T").at(0) ?? dateStr;
}

function calculateStreakDays(dailyUsage: DailyUsage[]): number {
  if (dailyUsage.length === 0) {
    return 0;
  }

  const sortedUsage = [...dailyUsage].toSorted(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const today = getDateString(new Date().toISOString());
  const yesterday = getDateString(new Date(Date.now() - 86_400_000).toISOString());

  const mostRecentDate = sortedUsage.at(0)?.date;

  if (mostRecentDate !== today && mostRecentDate !== yesterday) {
    return 0;
  }

  let streak = 0;
  let expectedDate = mostRecentDate === today ? new Date() : new Date(Date.now() - 86_400_000);

  for (const usage of sortedUsage) {
    const expectedDateStr = getDateString(expectedDate.toISOString());

    if (usage.date === expectedDateStr) {
      streak++;
      expectedDate = new Date(expectedDate.getTime() - 86_400_000);
    } else {
      break;
    }
  }

  return streak;
}

export function createUsageStatisticsService(): UsageStatisticsService {
  let cachedStatistics: UsageStatistics | null = null;

  function load(): UsageStatistics {
    const filePath = getUsageStatisticsFilePath();

    if (!existsSync(filePath)) {
      return createEmptyStatistics("Unknown Project");
    }

    try {
      const content = readFileSync(filePath, "utf8");
      const parsed: unknown = JSON.parse(content);

      if (!isUsageStatistics(parsed)) {
        return createEmptyStatistics("Unknown Project");
      }

      return parsed;
    } catch {
      return createEmptyStatistics("Unknown Project");
    }
  }

  function get(): UsageStatistics {
    if (cachedStatistics === null) {
      cachedStatistics = load();
    }

    return cachedStatistics;
  }

  function save(statistics: UsageStatistics): void {
    ensureProjectDirExists();
    writeFileIdempotent(getUsageStatisticsFilePath(), JSON.stringify(statistics, null, "\t"));
    cachedStatistics = statistics;
  }

  function exists(): boolean {
    return existsSync(getUsageStatisticsFilePath());
  }

  function initialize(projectName: string): UsageStatistics {
    if (exists()) {
      return get();
    }

    const emptyStatistics = createEmptyStatistics(projectName);

    save(emptyStatistics);

    return emptyStatistics;
  }

  function invalidate(): void {
    cachedStatistics = null;
  }

  function recordSession(options: RecordSessionOptions): void {
    const statistics = get();
    const now = new Date().toISOString();

    const sessionRecord: SessionRecord = {
      completedAt: options.completedAt,
      completedIterations: options.completedIterations,
      durationMs: options.durationMs,
      failedIterations: options.failedIterations,
      id: options.sessionId,
      startedAt: options.startedAt,
      status: options.status,
      successfulIterations: options.successfulIterations,
      tasksAttempted: options.tasksAttempted,
      tasksCompleted: options.tasksCompleted,
      totalIterations: options.totalIterations,
    };

    statistics.recentSessions.unshift(sessionRecord);
    statistics.recentSessions = statistics.recentSessions.slice(
      0,
      USAGE_STATISTICS_CONSTANTS.MAX_RECENT_SESSIONS,
    );

    statistics.lifetime.totalSessions += 1;
    statistics.lifetime.totalIterations += options.completedIterations;
    statistics.lifetime.totalTasksCompleted += options.tasksCompleted;
    statistics.lifetime.totalTasksAttempted += options.tasksAttempted;
    statistics.lifetime.totalDurationMs += options.durationMs;
    statistics.lifetime.successfulIterations += options.successfulIterations;
    statistics.lifetime.failedIterations += options.failedIterations;

    const { totalSessions } = statistics.lifetime;

    statistics.lifetime.averageIterationsPerSession =
      totalSessions > 0 ? statistics.lifetime.totalIterations / totalSessions : 0;
    statistics.lifetime.averageTasksPerSession =
      totalSessions > 0 ? statistics.lifetime.totalTasksCompleted / totalSessions : 0;
    statistics.lifetime.averageSessionDurationMs =
      totalSessions > 0 ? statistics.lifetime.totalDurationMs / totalSessions : 0;

    const totalIterations =
      statistics.lifetime.successfulIterations + statistics.lifetime.failedIterations;

    statistics.lifetime.overallSuccessRate =
      totalIterations > 0 ? (statistics.lifetime.successfulIterations / totalIterations) * 100 : 0;

    const sessionDate = getDateString(options.startedAt);
    const existingDayIndex = statistics.dailyUsage.findIndex((d) => d.date === sessionDate);

    if (existingDayIndex !== -1) {
      const existingDay = statistics.dailyUsage.at(existingDayIndex);

      if (existingDay) {
        existingDay.sessionsStarted += 1;
        existingDay.iterationsRun += options.completedIterations;
        existingDay.tasksCompleted += options.tasksCompleted;
        existingDay.totalDurationMs += options.durationMs;
      }
    } else {
      statistics.dailyUsage.push({
        date: sessionDate,
        iterationsRun: options.completedIterations,
        sessionsStarted: 1,
        tasksCompleted: options.tasksCompleted,
        totalDurationMs: options.durationMs,
      });
    }

    statistics.dailyUsage.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    statistics.dailyUsage = statistics.dailyUsage.slice(
      0,
      USAGE_STATISTICS_CONSTANTS.MAX_DAILY_USAGE_DAYS,
    );

    statistics.lastUpdatedAt = now;

    save(statistics);
  }

  function getSummary(): UsageStatisticsSummary {
    const statistics = get();
    const maybeLastSession = statistics.recentSessions.at(0);

    return {
      averageIterationsPerSession: statistics.lifetime.averageIterationsPerSession,
      averageSessionDurationMs: statistics.lifetime.averageSessionDurationMs,
      lastSessionAt: maybeLastSession?.startedAt ?? null,
      overallSuccessRate: statistics.lifetime.overallSuccessRate,
      streakDays: calculateStreakDays(statistics.dailyUsage),
      totalDurationMs: statistics.lifetime.totalDurationMs,
      totalIterations: statistics.lifetime.totalIterations,
      totalSessions: statistics.lifetime.totalSessions,
      totalTasksCompleted: statistics.lifetime.totalTasksCompleted,
    };
  }

  function getRecentSessions(limit = 10): SessionRecord[] {
    const statistics = get();

    return statistics.recentSessions.slice(0, limit);
  }

  function getDailyUsage(days = 7): DailyUsage[] {
    const statistics = get();

    return statistics.dailyUsage.slice(0, days);
  }

  function formatForDisplay(): string {
    const summary = getSummary();
    const recentSessions = getRecentSessions(5);
    const dailyUsage = getDailyUsage(7);

    const lines: string[] = [];

    lines.push("=== Usage Statistics ===\n");
    lines.push("Lifetime Statistics:");
    lines.push(`  Total Sessions: ${summary.totalSessions}`);
    lines.push(`  Total Iterations: ${summary.totalIterations}`);
    lines.push(`  Tasks Completed: ${summary.totalTasksCompleted}`);
    lines.push(`  Total Time: ${formatDuration(summary.totalDurationMs)}`);
    lines.push(`  Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`);
    lines.push(`  Avg Session Duration: ${formatDuration(summary.averageSessionDurationMs)}`);
    lines.push(`  Avg Iterations/Session: ${summary.averageIterationsPerSession.toFixed(1)}`);

    if (summary.streakDays > 0) {
      lines.push(`  Current Streak: ${summary.streakDays} day${summary.streakDays > 1 ? "s" : ""}`);
    }

    if (summary.lastSessionAt) {
      lines.push(`  Last Session: ${new Date(summary.lastSessionAt).toLocaleString()}`);
    }

    if (dailyUsage.length > 0) {
      lines.push("\nDaily Usage (Last 7 Days):");

      for (const day of dailyUsage) {
        lines.push(
          `  ${day.date}: ${day.sessionsStarted} session${day.sessionsStarted !== 1 ? "s" : ""}, ${day.iterationsRun} iteration${day.iterationsRun !== 1 ? "s" : ""}, ${day.tasksCompleted} task${day.tasksCompleted !== 1 ? "s" : ""}`,
        );
      }
    }

    if (recentSessions.length > 0) {
      lines.push("\nRecent Sessions:");

      for (const session of recentSessions) {
        const date = new Date(session.startedAt).toLocaleString();
        const duration = formatDuration(session.durationMs);
        const statusIcon =
          session.status === "completed" ? "✓" : session.status === "stopped" ? "⏹" : "✗";

        lines.push(
          `  ${statusIcon} ${date} - ${duration}, ${session.completedIterations}/${session.totalIterations} iterations, ${session.tasksCompleted} tasks`,
        );
      }
    }

    return lines.join("\n");
  }

  return {
    exists,
    formatForDisplay,
    get,
    getDailyUsage,
    getRecentSessions,
    getSummary,
    initialize,
    invalidate,
    load,
    recordSession,
    save,
  };
}
