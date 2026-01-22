import { Box, Text, useInput } from "ink";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";

interface HelpViewProps {
	version: string;
	onClose: () => void;
}

function HelpHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version}
			</Text>
		</Box>
	);
}

function HelpFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Enter, Escape, or 'q' to close</Text>
		</Box>
	);
}

export function HelpView({ version, onClose }: HelpViewProps): React.ReactElement {
	useInput((input, key) => {
		if (key.escape || key.return || input === "q") {
			onClose();
		}
	});

	return (
		<ResponsiveLayout
			header={<HelpHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
						<Text>A CLI tool for long-running PRD-driven development with AI coding agents</Text>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								CLI Usage:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>ralph [iterations]</Text>
									{"      "}
									<Text>Run the agent loop (default: 10 iterations)</Text>
								</Text>
								<Text>
									<Text dimColor>ralph {"<command>"}</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								CLI Commands:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>init</Text>
									{"              "}
									<Text>Initialize a new PRD project (AI-generated)</Text>
								</Text>
								<Text>
									<Text dimColor>resume</Text>
									{"            "}
									<Text>Resume a previously interrupted session</Text>
								</Text>
								<Text>
									<Text dimColor>setup</Text>
									{"             "}
									<Text>Configure global preferences</Text>
								</Text>
								<Text>
									<Text dimColor>update</Text>
									{"            "}
									<Text>Check for updates</Text>
								</Text>
								<Text>
									<Text dimColor>help</Text>
									{"              "}
									<Text>Show this help message</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								CLI Options:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>-t, --task {"<n>"}</Text>
									{"     "}
									<Text>Run specific task by number or title</Text>
								</Text>
								<Text>
									<Text dimColor>-b, --background</Text>
									{"  "}
									<Text>Run in background/daemon mode</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Session Control:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/session start [n|full]</Text> <Text>Start agent loop</Text>
								</Text>
								<Text>
									<Text dimColor>/session stop</Text>
									{"          "}
									<Text>Stop the running agent</Text>
								</Text>
								<Text>
									<Text dimColor>/session resume</Text>
									{"        "}
									<Text>Resume interrupted session</Text>
								</Text>
								<Text>
									<Text dimColor>/session pause</Text>
									{"         "}
									<Text>Pause the current session</Text>
								</Text>
								<Text>
									<Text dimColor>/session clear</Text>
									{"         "}
									<Text>Clear session data</Text>
								</Text>
								<Text>
									<Text dimColor>/session refresh</Text>
									{"       "}
									<Text>Reload PRD from disk</Text>
								</Text>
								<Text>
									<Text dimColor>/session archive</Text>
									{"       "}
									<Text>Archive completed tasks</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Task Management:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/task done {"<id>"}</Text>
									{"        "}
									<Text>Mark task as done</Text>
								</Text>
								<Text>
									<Text dimColor>/task undone {"<id>"}</Text>
									{"      "}
									<Text>Mark task as pending</Text>
								</Text>
								<Text>
									<Text dimColor>/task current</Text>
									{"          "}
									<Text>Show next pending task</Text>
								</Text>
								<Text>
									<Text dimColor>/tasks</Text>
									{"                 "}
									<Text>Open the tasks view</Text>
								</Text>
								<Text>
									<Text dimColor>/next [n|title]</Text>
									{"        "}
									<Text>Set next task to work on</Text>
								</Text>
								<Text>
									<Text dimColor>/add</Text>
									{"                   "}
									<Text>Add a new task (AI-generated)</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Project Setup:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/init</Text>
									{"                  "}
									<Text>Initialize a new PRD project</Text>
								</Text>
								<Text>
									<Text dimColor>/setup</Text>
									{"                 "}
									<Text>Configure global preferences</Text>
								</Text>
								<Text>
									<Text dimColor>/agent</Text>
									{"                 "}
									<Text>Switch coding agent</Text>
								</Text>
								<Text>
									<Text dimColor>/projects</Text>
									{"              "}
									<Text>View all projects</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Views & Info:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/status</Text>
									{"                "}
									<Text>Show session and project status</Text>
								</Text>
								<Text>
									<Text dimColor>/guardrails</Text>
									{"            "}
									<Text>View and manage guardrails</Text>
								</Text>
								<Text>
									<Text dimColor>/rules</Text>
									{"                 "}
									<Text>View and manage rules</Text>
								</Text>
								<Text>
									<Text dimColor>/memory</Text>
									{"                "}
									<Text>View and manage session memory</Text>
								</Text>
								<Text>
									<Text dimColor>/analyze</Text>
									{"               "}
									<Text>View failure pattern analysis</Text>
								</Text>
								<Text>
									<Text dimColor>/usage</Text>
									{"                 "}
									<Text>View usage statistics</Text>
								</Text>
								<Text>
									<Text dimColor>/config</Text>
									{"                "}
									<Text>View effective configuration</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Quick Actions:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/guardrail {"<text>"}</Text>
									{"       "}
									<Text>Add a guardrail instruction</Text>
								</Text>
								<Text>
									<Text dimColor>/rule {"<text>"}</Text>
									{"            "}
									<Text>Add a rule instruction</Text>
								</Text>
								<Text>
									<Text dimColor>/learn {"<lesson>"}</Text>
									{"        "}
									<Text>Add a lesson to memory</Text>
								</Text>
								<Text>
									<Text dimColor>/note {"<note>"}</Text>
									{"           "}
									<Text>Add a note about current task</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Application:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>/help</Text>
									{"                  "}
									<Text>Show this help message</Text>
								</Text>
								<Text>
									<Text dimColor>/update</Text>
									{"                "}
									<Text>Check for updates</Text>
								</Text>
								<Text>
									<Text dimColor>/quit, /q</Text>
									{"              "}
									<Text>Exit the application</Text>
								</Text>
								<Text>
									<Text dimColor>/exit, /e</Text>
									{"              "}
									<Text>Exit (alias)</Text>
								</Text>
							</Box>
						</Box>

						<Box flexDirection="column" marginTop={1}>
							<Text bold color="yellow">
								Examples:
							</Text>
							<Box flexDirection="column" paddingLeft={2}>
								<Text>
									<Text dimColor>ralph</Text>
									{"              "}
									<Text>Run 10 iterations</Text>
								</Text>
								<Text>
									<Text dimColor>ralph 5</Text>
									{"            "}
									<Text>Run 5 iterations</Text>
								</Text>
								<Text>
									<Text dimColor>ralph -t 3</Text>
									{"         "}
									<Text>Run specific task #3</Text>
								</Text>
								<Text>
									<Text dimColor>ralph init</Text>
									{"         "}
									<Text>Create a new PRD project</Text>
								</Text>
							</Box>
						</Box>
					</Box>
				</ScrollableContent>
			}
			footer={<HelpFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
