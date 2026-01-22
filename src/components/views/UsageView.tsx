import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { getUsageStatisticsService } from "@/lib/services/index.ts";
import { Header } from "../Header.tsx";

interface UsageViewProps {
	version: string;
	onClose: () => void;
}

type UsageTab = "summary" | "sessions" | "daily";

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1_000);
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

export const UsageView: React.FC<UsageViewProps> = ({ version, onClose }) => {
	const usageStatisticsService = getUsageStatisticsService();
	const [statistics] = useState(() => usageStatisticsService.get());
	const [activeTab, setActiveTab] = useState<UsageTab>("summary");
	const hasUsage = usageStatisticsService.exists();

	const summary = usageStatisticsService.getSummary();
	const recentSessions = usageStatisticsService.getRecentSessions(10);
	const dailyUsage = usageStatisticsService.getDailyUsage(14);

	const tabs: { key: UsageTab; label: string }[] = [
		{ key: "summary", label: "Summary" },
		{ key: "sessions", label: `Sessions (${recentSessions.length})` },
		{ key: "daily", label: `Daily (${dailyUsage.length})` },
	];

	useInput((input, key) => {
		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (key.leftArrow) {
			const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
			const newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;

			setActiveTab(tabs[newIndex]?.key ?? "summary");
		}

		if (key.rightArrow) {
			const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
			const newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;

			setActiveTab(tabs[newIndex]?.key ?? "summary");
		}
	});

	const renderTabContent = () => {
		switch (activeTab) {
			case "summary":
				if (!hasUsage || summary.totalSessions === 0) {
					return (
						<Text dimColor>No usage data recorded yet. Run some sessions to see statistics.</Text>
					);
				}

				return (
					<Box flexDirection="column" gap={1}>
						<Box flexDirection="column">
							<Text bold color="yellow">
								Lifetime Statistics
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>Total Sessions:</Text> {summary.totalSessions}
								</Text>
								<Text>
									<Text dimColor>Total Iterations:</Text> {summary.totalIterations}
								</Text>
								<Text>
									<Text dimColor>Tasks Completed:</Text> {summary.totalTasksCompleted}
								</Text>
								<Text>
									<Text dimColor>Total Time:</Text> {formatDuration(summary.totalDurationMs)}
								</Text>
								<Text>
									<Text dimColor>Success Rate:</Text> {summary.overallSuccessRate.toFixed(1)}%
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column">
							<Text bold color="yellow">
								Averages
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>Avg Session Duration:</Text>{" "}
									{formatDuration(summary.averageSessionDurationMs)}
								</Text>
								<Text>
									<Text dimColor>Avg Iterations/Session:</Text>{" "}
									{summary.averageIterationsPerSession.toFixed(1)}
								</Text>
							</Box>
						</Box>

						{summary.streakDays > 0 && (
							<Box flexDirection="column">
								<Text bold color="yellow">
									Streak
								</Text>
								<Box paddingLeft={2}>
									<Text>
										<Text dimColor>Current Streak:</Text>{" "}
										<Text color="green">
											{summary.streakDays} day{summary.streakDays > 1 ? "s" : ""}
										</Text>
									</Text>
								</Box>
							</Box>
						)}

						{summary.lastSessionAt && (
							<Box flexDirection="column">
								<Text bold color="yellow">
									Activity
								</Text>
								<Box paddingLeft={2}>
									<Text>
										<Text dimColor>Last Session:</Text>{" "}
										{new Date(summary.lastSessionAt).toLocaleString()}
									</Text>
								</Box>
							</Box>
						)}
					</Box>
				);

			case "sessions":
				if (recentSessions.length === 0) {
					return <Text dimColor>No sessions recorded yet.</Text>;
				}

				return (
					<Box flexDirection="column">
						{recentSessions.map((session) => {
							const statusIcon =
								session.status === "completed" ? "✓" : session.status === "stopped" ? "⏹" : "✗";
							const statusColor =
								session.status === "completed"
									? "green"
									: session.status === "stopped"
										? "yellow"
										: "red";

							return (
								<Box key={session.id} flexDirection="column" marginBottom={1}>
									<Box gap={1}>
										<Text color={statusColor}>{statusIcon}</Text>
										<Text>{new Date(session.startedAt).toLocaleString()}</Text>
									</Box>
									<Box paddingLeft={3}>
										<Text dimColor>
											{formatDuration(session.durationMs)} • {session.completedIterations}/
											{session.totalIterations} iterations • {session.tasksCompleted} tasks
										</Text>
									</Box>
								</Box>
							);
						})}
					</Box>
				);

			case "daily":
				if (dailyUsage.length === 0) {
					return <Text dimColor>No daily usage data recorded yet.</Text>;
				}

				return (
					<Box flexDirection="column">
						{dailyUsage.map((day) => (
							<Box key={day.date} gap={2}>
								<Text bold>{day.date}</Text>
								<Text dimColor>
									{day.sessionsStarted} session{day.sessionsStarted !== 1 ? "s" : ""} •{" "}
									{day.iterationsRun} iteration{day.iterationsRun !== 1 ? "s" : ""} •{" "}
									{day.tasksCompleted} task{day.tasksCompleted !== 1 ? "s" : ""} •{" "}
									{formatDuration(day.totalDurationMs)}
								</Text>
							</Box>
						))}
					</Box>
				);
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />

			<Box flexDirection="column" marginTop={1}>
				<Text bold color="cyan">
					Usage Statistics: {statistics.projectName}
				</Text>
				{hasUsage && <Text dimColor>Last updated: {statistics.lastUpdatedAt}</Text>}
			</Box>

			<Box marginTop={1} gap={2}>
				{tabs.map((tab) => (
					<Box key={tab.key}>
						<Text
							bold={activeTab === tab.key}
							color={activeTab === tab.key ? "cyan" : undefined}
							dimColor={activeTab !== tab.key}
						>
							{activeTab === tab.key ? "▸ " : "  "}
							{tab.label}
						</Text>
					</Box>
				))}
			</Box>

			<Box
				flexDirection="column"
				marginTop={1}
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				paddingY={1}
				minHeight={10}
			>
				{renderTabContent()}
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text dimColor>Press q or Escape to close</Text>
				<Text dimColor>Use ←/→ to switch tabs</Text>
			</Box>
		</Box>
	);
};
