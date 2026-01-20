import { Box, Text } from "ink";
import type { RalphConfig, Session } from "@/types.ts";
import { type CommandArgs, CommandInput, type SlashCommand } from "../CommandInput.tsx";
import { Message } from "../common/Message.tsx";
import { Header } from "../Header.tsx";

interface ResumePromptViewProps {
	version: string;
	config: RalphConfig | null;
	projectName?: string;
	pendingSession: Session;
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
}

function formatElapsedTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	if (hours > 0) {
		return `${hours}h ${minutes}m ${secs}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${secs}s`;
	}
	return `${secs}s`;
}

export function ResumePromptView({
	version,
	config,
	projectName,
	pendingSession,
	onCommand,
}: ResumePromptViewProps): React.ReactElement {
	const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} agent={config?.agent} projectName={projectName} />
			<Box flexDirection="column" marginY={1} paddingX={1} gap={1}>
				<Message type="info">Found an existing session</Message>
				<Box flexDirection="column" paddingLeft={2}>
					<Text>
						<Text dimColor>Iterations completed:</Text>{" "}
						<Text color="cyan">{pendingSession.currentIteration}</Text>
						<Text dimColor> / </Text>
						<Text>{pendingSession.totalIterations}</Text>
					</Text>
					<Text>
						<Text dimColor>Elapsed time:</Text>{" "}
						<Text color="cyan">{formatElapsedTime(pendingSession.elapsedTimeSeconds)}</Text>
					</Text>
					<Text>
						<Text dimColor>Remaining iterations:</Text>{" "}
						<Text color="cyan">{remainingIterations > 0 ? remainingIterations : 0}</Text>
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text>
						Type <Text color="cyan">/resume</Text> to continue or <Text color="yellow">/start</Text>{" "}
						to start fresh
					</Text>
				</Box>
			</Box>
			<CommandInput onCommand={onCommand} />
		</Box>
	);
}
