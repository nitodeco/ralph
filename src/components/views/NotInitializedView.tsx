import { Box, Text } from "ink";
import type { ValidationWarning } from "@/types.ts";
import { type CommandArgs, CommandInput, type SlashCommand } from "../CommandInput.tsx";
import { Message } from "../common/Message.tsx";
import { Header } from "../Header.tsx";

interface NotInitializedViewProps {
	version: string;
	validationWarning: ValidationWarning;
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
}

export function NotInitializedView({
	version,
	validationWarning,
	onCommand,
}: NotInitializedViewProps): React.ReactElement {
	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginY={1} paddingX={1}>
				<Message type="warning">{validationWarning.message}</Message>
				<Text dimColor>{validationWarning.hint}</Text>
			</Box>
			<CommandInput onCommand={onCommand} />
		</Box>
	);
}
