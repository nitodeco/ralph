import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

export type SlashCommand = "init" | "setup" | "update" | "help" | "quit" | "exit";

const VALID_COMMANDS: SlashCommand[] = ["init", "setup", "update", "help", "quit", "exit"];

interface CommandInputProps {
	onCommand: (command: SlashCommand) => void;
	disabled?: boolean;
}

function parseSlashCommand(input: string): SlashCommand | null {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed.startsWith("/")) {
		return null;
	}

	const command = trimmed.slice(1) as SlashCommand;
	if (VALID_COMMANDS.includes(command)) {
		return command;
	}

	return null;
}

export function CommandInput({ onCommand, disabled = false }: CommandInputProps): React.ReactElement {
	const [inputValue, setInputValue] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = (value: string) => {
		if (!value.trim()) {
			return;
		}

		const command = parseSlashCommand(value);
		if (command) {
			setError(null);
			setInputValue("");
			onCommand(command);
		} else {
			setError(`Unknown command: ${value}`);
			setInputValue("");
		}
	};

	if (disabled) {
		return (
			<Box borderStyle="round" borderColor="gray" paddingX={1}>
				<Text dimColor>Type /help for available commands</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Box gap={1}>
					<Text color="cyan">❯</Text>
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={handleSubmit}
						placeholder="/command"
					/>
				</Box>
				{error && (
					<Box>
						<Text color="red">{error}</Text>
					</Box>
				)}
			</Box>
			<Box paddingLeft={1}>
				<Text dimColor>Enter /help for a list of commands</Text>
			</Box>
		</Box>
	);
}
