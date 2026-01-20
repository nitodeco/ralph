import { Box, Text, useInput } from "ink";

interface HelpViewProps {
	version: string;
	onClose: () => void;
}

export function HelpView({ version, onClose }: HelpViewProps): React.ReactElement {
	useInput((input, key) => {
		if (key.escape || key.return || input === "q") {
			onClose();
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version}
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
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
						Slash Commands (in-app):
					</Text>
					<Box flexDirection="column" paddingLeft={2}>
						<Text>
							<Text dimColor>/start [n|full]</Text>
							{"   "}
							<Text>Start the agent loop (default: 10, full: all tasks)</Text>
						</Text>
						<Text>
							<Text dimColor>/stop</Text>
							{"             "}
							<Text>Stop the running agent</Text>
						</Text>
						<Text>
							<Text dimColor>/resume</Text>
							{"           "}
							<Text>Resume a previously interrupted session</Text>
						</Text>
						<Text>
							<Text dimColor>/init</Text>
							{"             "}
							<Text>Initialize a new PRD project (AI-generated)</Text>
						</Text>
						<Text>
							<Text dimColor>/add</Text>
							{"              "}
							<Text>Add a new task to the PRD (AI-generated)</Text>
						</Text>
						<Text>
							<Text dimColor>/next [n|title]</Text>
							{"   "}
							<Text>Set the next task to work on (by number or title)</Text>
						</Text>
						<Text>
							<Text dimColor>/setup</Text>
							{"            "}
							<Text>Configure global preferences</Text>
						</Text>
						<Text>
							<Text dimColor>/update</Text>
							{"           "}
							<Text>Check for updates</Text>
						</Text>
						<Text>
							<Text dimColor>/help</Text>
							{"             "}
							<Text>Show this help message</Text>
						</Text>
						<Text>
							<Text dimColor>/quit</Text>
							{"             "}
							<Text>Exit the application</Text>
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

				<Box marginTop={1}>
					<Text dimColor>Press Enter, Escape, or 'q' to close</Text>
				</Box>
			</Box>
		</Box>
	);
}
