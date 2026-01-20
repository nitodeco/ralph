import { Box, Text, useInput } from "ink";
import { formatElapsedTime } from "@/cli/formatters.ts";
import { isBackgroundProcessRunning } from "@/lib/daemon.ts";
import { getRecentLogEntries } from "@/lib/logger.ts";
import { loadPrd } from "@/lib/prd.ts";
import { loadSession } from "@/lib/session.ts";

interface StatusViewProps {
	version: string;
	onClose: () => void;
}

export function StatusView({ version, onClose }: StatusViewProps): React.ReactElement {
	useInput((input, key) => {
		if (key.escape || key.return || input === "q") {
			onClose();
		}
	});

	const { running, pid } = isBackgroundProcessRunning();
	const session = loadSession();
	const prd = loadPrd();

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Status
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
				<Box flexDirection="column">
					<Text bold color="yellow">
						Process Status:
					</Text>
					<Box paddingLeft={2}>
						{running && pid !== null ? (
							<Text>
								Running (PID: <Text color="green">{pid}</Text>)
							</Text>
						) : session ? (
							<Text>Not running</Text>
						) : (
							<Text>No active session</Text>
						)}
					</Box>
				</Box>

				{session ? (
					<>
						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Session Information:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									Status: <Text color="cyan">{session.status}</Text>
								</Text>
								<Text>
									Started: <Text color="cyan">{new Date(session.startTime).toLocaleString()}</Text>
								</Text>
								<Text>
									Last Update:{" "}
									<Text color="cyan">{new Date(session.lastUpdateTime).toLocaleString()}</Text>
								</Text>
								<Text>
									Elapsed Time:{" "}
									<Text color="cyan">{formatElapsedTime(session.elapsedTimeSeconds)}</Text>
								</Text>
								<Text>
									Iteration:{" "}
									<Text color="cyan">
										{session.currentIteration} / {session.totalIterations}
									</Text>
								</Text>
							</Box>
						</Box>

						{prd ? (
							<Box flexDirection="column" marginTop={1}>
								<Text bold color="yellow">
									Project Progress:
								</Text>
								<Box flexDirection="column" paddingLeft={2}>
									<Text>
										Project: <Text color="cyan">{prd.project}</Text>
									</Text>
									{(() => {
										const completedTasks = prd.tasks.filter((task) => task.done).length;
										const totalTasks = prd.tasks.length;
										const progressPercent =
											totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

										return (
											<Text>
												Tasks:{" "}
												<Text color="cyan">
													{completedTasks} / {totalTasks} ({progressPercent}%)
												</Text>
											</Text>
										);
									})()}
									{(() => {
										const currentTask = prd.tasks[session.currentTaskIndex];

										if (
											session.currentTaskIndex >= 0 &&
											session.currentTaskIndex < prd.tasks.length &&
											currentTask
										) {
											return (
												<Text>
													Current Task: <Text color="cyan">{currentTask.title}</Text>
												</Text>
											);
										} else {
											const nextTask = prd.tasks.find((task) => !task.done);

											if (nextTask) {
												return (
													<Text>
														Next Task: <Text color="cyan">{nextTask.title}</Text>
													</Text>
												);
											} else {
												return (
													<Text>
														Status: <Text color="green">All tasks complete!</Text>
													</Text>
												);
											}
										}
									})()}
								</Box>
							</Box>
						) : (
							<Box flexDirection="column" marginTop={1}>
								<Text>No PRD found in .ralph/prd.json</Text>
							</Box>
						)}

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Recent Log Entries:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								{(() => {
									const recentLogs = getRecentLogEntries(10);

									if (recentLogs.length > 0) {
										return recentLogs.map((logEntry) => (
											<Text key={logEntry} dimColor>
												{logEntry}
											</Text>
										));
									} else {
										return <Text dimColor>No log entries found.</Text>;
									}
								})()}
							</Box>
						</Box>

						{!running && session.status === "running" && (
							<Box flexDirection="column" marginTop={1}>
								<Text color="yellow" bold>
									Note:
								</Text>
								<Box marginTop={1} flexDirection="column">
									<Text color="yellow">Session appears to have been interrupted.</Text>
									<Text color="yellow">
										Use 'ralph resume' or type /resume to continue from where you left off.
									</Text>
								</Box>
							</Box>
						)}
					</>
				) : (
					<Box flexDirection="column" marginTop={1}>
						<Text>No session data found.</Text>
						<Box marginTop={1}>
							<Text dimColor>Run 'ralph' or 'ralph -b' to start a new session.</Text>
						</Box>
					</Box>
				)}

				<Box marginTop={1}>
					<Text dimColor>Press Enter, Escape, or 'q' to close</Text>
				</Box>
			</Box>
		</Box>
	);
}
