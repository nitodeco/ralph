import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";

export type SlashCommand =
	| "init"
	| "setup"
	| "update"
	| "help"
	| "quit"
	| "exit"
	| "add"
	| "start"
	| "resume"
	| "stop";

export interface CommandArgs {
	iterations?: number;
	full?: boolean;
}

const VALID_COMMANDS: SlashCommand[] = [
	"init",
	"setup",
	"update",
	"help",
	"quit",
	"exit",
	"add",
	"start",
	"resume",
	"stop",
];
const RUNNING_COMMANDS: SlashCommand[] = ["stop", "quit", "exit", "help"];

interface CommandInputProps {
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	isRunning?: boolean;
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

export function CommandInput({
	onCommand,
	isRunning = false,
}: CommandInputProps): React.ReactElement {
	const [inputValue, setInputValue] = useState("");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = (value: string) => {
		if (!value.trim()) {
			return;
		}

		const parsed = parseSlashCommand(value);
		if (parsed) {
			if (isRunning && !RUNNING_COMMANDS.includes(parsed.command)) {
				setError(
					`Command /${parsed.command} not available while agent is running. Use /stop, /quit, or /help`,
				);
				setInputValue("");
				return;
			}
			setError(null);
			setInputValue("");
			onCommand(parsed.command, parsed.args);
		} else {
			setError(`Unknown command: ${value}`);
			setInputValue("");
		}
	};

	const borderColor = isRunning ? "yellow" : "cyan";
	const promptColor = isRunning ? "yellow" : "cyan";
	const placeholder = isRunning ? "/stop" : "/command";
	const hintText = isRunning
		? "Press Escape or type /stop to stop the agent"
		: "Enter /help for a list of commands";

	return (
		<Box flexDirection="column">
			<Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1}>
				<Box gap={1}>
					<Text color={promptColor}>❯</Text>
					<TextInput
						value={inputValue}
						onChange={setInputValue}
						onSubmit={handleSubmit}
						placeholder={placeholder}
					/>
				</Box>
				{error && (
					<Box>
						<Text color="red">{error}</Text>
					</Box>
				)}
			</Box>
			<Box paddingLeft={1}>
				<Text dimColor>{hintText}</Text>
			</Box>
		</Box>
	);
}
