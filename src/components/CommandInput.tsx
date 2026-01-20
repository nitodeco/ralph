import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

export type SlashCommand = "init" | "setup" | "update" | "help" | "quit" | "exit" | "add" | "start" | "resume";

export interface CommandArgs {
	iterations?: number;
	full?: boolean;
}

const VALID_COMMANDS: SlashCommand[] = ["init", "setup", "update", "help", "quit", "exit", "add", "start", "resume"];

interface CommandInputProps {
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	disabled?: boolean;
}

interface ParsedCommand {
	command: SlashCommand;
	args?: CommandArgs;
}

function parseSlashCommand(input: string): ParsedCommand | null {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed.startsWith("/")) {
		return null;
	}

	const parts = trimmed.slice(1).split(/\s+/);
	const commandName = parts[0] as SlashCommand;

	if (!VALID_COMMANDS.includes(commandName)) {
		return null;
	}

	if (commandName === "start" && parts[1]) {
		if (parts[1] === "full") {
			return { command: commandName, args: { full: true } };
		}

		const iterations = Number.parseInt(parts[1], 10);
		
		if (!Number.isNaN(iterations) && iterations > 0) {
			return { command: commandName, args: { iterations } };
		}
	}

	return { command: commandName };
}

export function CommandInput({ onCommand, disabled = false }: CommandInputProps): React.ReactElement {
	const [inputValue, setInputValue] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = (value: string) => {
		if (!value.trim()) {
			return;
		}

		const parsed = parseSlashCommand(value);
		if (parsed) {
			setError(null);
			setInputValue("");
			onCommand(parsed.command, parsed.args);
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
