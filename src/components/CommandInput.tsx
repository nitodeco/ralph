import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { addCommandToHistory, getCommandHistoryList } from "@/lib/command-history.ts";
import { expandPastedSegments, type PastedTextSegment, TextInput } from "./common/TextInput.tsx";

export type TaskSubcommand = "done" | "undone" | "current" | "list";
export type SessionSubcommand =
	| "start"
	| "stop"
	| "resume"
	| "pause"
	| "clear"
	| "refresh"
	| "archive";

export type SlashCommand =
	| "init"
	| "setup"
	| "update"
	| "help"
	| "quit"
	| "exit"
	| "q"
	| "e"
	| "add"
	| "session"
	| "next"
	| "status"
	| "guardrail"
	| "guardrails"
	| "analyze"
	| "learn"
	| "note"
	| "memory"
	| "dismiss-update"
	| "agent"
	| "task"
	| "tasks"
	| "projects"
	| "migrate"
	| "plan"
	| "usage"
	| "config"
	| "auth"
	| "github";

export interface CommandArgs {
	iterations?: number;
	full?: boolean;
	taskIdentifier?: string;
	guardrailInstruction?: string;
	lesson?: string;
	note?: string;
	taskSubcommand?: TaskSubcommand;
	sessionSubcommand?: SessionSubcommand;
}

interface CommandHint {
	description: string;
	args?: string;
}

const COMMAND_HINTS: Record<SlashCommand, CommandHint> = {
	session: {
		description: "Session control",
		args: "<start|stop|resume|pause|clear|refresh|archive> [n|full]",
	},
	init: { description: "Initialize a new PRD project" },
	add: { description: "Add a new task to the PRD" },
	next: { description: "Set the next task to work on", args: "[n|title]" },
	task: { description: "Manage tasks", args: "<done|undone|current|list> [id]" },
	tasks: { description: "Open the tasks view" },
	setup: { description: "Configure global preferences" },
	agent: { description: "Switch coding agent" },
	update: { description: "Check for updates" },
	status: { description: "Show session and project status" },
	guardrail: { description: "Add a new guardrail instruction", args: "<text>" },
	guardrails: { description: "View and manage guardrails" },
	analyze: { description: "View failure pattern analysis" },
	learn: { description: "Add a lesson to session memory", args: "<lesson>" },
	note: { description: "Add a note about the current task", args: "<note>" },
	memory: { description: "View and manage session memory" },
	"dismiss-update": { description: "Dismiss the update notification" },
	help: { description: "Show help message" },
	quit: { description: "Exit the application" },
	exit: { description: "Exit the application" },
	q: { description: "Exit the application (alias for /quit)" },
	e: { description: "Exit the application (alias for /exit)" },
	projects: { description: "Manage projects" },
	migrate: { description: "Migrate project data" },
	plan: { description: "View the current plan" },
	usage: { description: "View usage statistics" },
	config: { description: "View configuration settings" },
	auth: { description: "Authenticate with GitHub via OAuth" },
	github: { description: "Configure GitHub integration" },
};

const VALID_COMMANDS = Object.keys(COMMAND_HINTS) as SlashCommand[];
const VALID_TASK_SUBCOMMANDS: TaskSubcommand[] = ["done", "undone", "current", "list"];
const VALID_SESSION_SUBCOMMANDS: SessionSubcommand[] = [
	"start",
	"stop",
	"resume",
	"pause",
	"clear",
	"refresh",
	"archive",
];
const RUNNING_COMMANDS: SlashCommand[] = ["session", "quit", "exit", "q", "e", "help", "status"];

interface AutocompleteResult {
	type: "suggestions" | "argument-hint" | "default";
	suggestions?: Array<{ command: SlashCommand; hint: CommandHint }>;
	argumentHint?: string;
	commonPrefix?: string;
}

export function getCommonPrefix(commands: readonly string[]): string {
	if (commands.length === 0) {
		return "";
	}

	if (commands.length === 1) {
		return commands.at(0) ?? "";
	}

	const [firstCommand, ...restCommands] = commands;

	if (!firstCommand) {
		return "";
	}

	let prefix = firstCommand;

	for (const command of restCommands) {
		while (prefix.length > 0 && !command.startsWith(prefix)) {
			prefix = prefix.slice(0, -1);
		}

		if (prefix.length === 0) {
			break;
		}
	}

	return prefix;
}

export function getAutocompleteHint(input: string, isRunning: boolean): AutocompleteResult {
	const trimmed = input.trim();

	if (!trimmed.startsWith("/")) {
		return { type: "default" };
	}

	const parts = trimmed.slice(1).split(/\s+/);
	const [partialCommand, ...restParts] = parts;

	if (partialCommand === undefined) {
		return { type: "default" };
	}

	const commandLower = partialCommand.toLowerCase();
	const availableCommands = isRunning ? RUNNING_COMMANDS : VALID_COMMANDS;
	const exactMatch = availableCommands.find((cmd) => cmd === commandLower);

	if (exactMatch) {
		const hint = COMMAND_HINTS[exactMatch];
		const hasEnteredArgs = restParts.length > 0 || trimmed.endsWith(" ");

		if (hint.args && !hasEnteredArgs) {
			return {
				type: "argument-hint",
				argumentHint: `/${exactMatch} ${hint.args} — ${hint.description}`,
			};
		}

		return { type: "default" };
	}

	const matchingCommands = availableCommands
		.filter((cmd) => cmd.startsWith(commandLower))
		.map((cmd) => ({ command: cmd, hint: COMMAND_HINTS[cmd] }));

	if (matchingCommands.length > 0) {
		const commandNames = matchingCommands.map(({ command }) => command);
		const commonPrefix = getCommonPrefix(commandNames);

		return { type: "suggestions", suggestions: matchingCommands, commonPrefix };
	}

	return { type: "default" };
}

interface CommandInputProps {
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	isRunning?: boolean;
	helpMode?: boolean;
	pendingCommand?: string | null;
	onPendingCommandConsumed?: () => void;
}

interface ParsedCommand {
	command: SlashCommand;
	args?: CommandArgs;
}

function parseSlashCommand(input: string): ParsedCommand | null {
	const trimmed = input.trim();

	if (!trimmed.startsWith("/")) {
		return null;
	}

	const parts = trimmed.slice(1).split(/\s+/);
	const [firstPart, secondPart] = parts;

	if (!firstPart) {
		return null;
	}

	const commandName = firstPart.toLowerCase() as SlashCommand;

	if (!VALID_COMMANDS.includes(commandName)) {
		return null;
	}

	if (commandName === "session") {
		const subcommand = secondPart?.toLowerCase() as SessionSubcommand | undefined;

		if (!subcommand || !VALID_SESSION_SUBCOMMANDS.includes(subcommand)) {
			return null;
		}

		if (subcommand === "start") {
			const [, , thirdPart] = parts;

			if (thirdPart) {
				if (thirdPart.toLowerCase() === "full") {
					return { command: commandName, args: { sessionSubcommand: subcommand, full: true } };
				}

				const iterations = Number.parseInt(thirdPart, 10);

				if (!Number.isNaN(iterations) && iterations > 0) {
					return { command: commandName, args: { sessionSubcommand: subcommand, iterations } };
				}
			}
		}

		return { command: commandName, args: { sessionSubcommand: subcommand } };
	}

	if (commandName === "next" && parts.length > 1) {
		const taskIdentifier = parts.slice(1).join(" ");

		return { command: commandName, args: { taskIdentifier } };
	}

	if (commandName === "guardrail" && parts.length > 1) {
		const guardrailInstruction = parts.slice(1).join(" ");

		return { command: commandName, args: { guardrailInstruction } };
	}

	if (commandName === "learn" && parts.length > 1) {
		const lesson = parts.slice(1).join(" ");

		return { command: commandName, args: { lesson } };
	}

	if (commandName === "note" && parts.length > 1) {
		const note = parts.slice(1).join(" ");

		return { command: commandName, args: { note } };
	}

	if (commandName === "task") {
		const subcommand = secondPart?.toLowerCase() as TaskSubcommand | undefined;

		if (!subcommand || !VALID_TASK_SUBCOMMANDS.includes(subcommand)) {
			return null;
		}

		if (subcommand === "done" || subcommand === "undone") {
			const taskIdentifier = parts.slice(2).join(" ");

			return { command: commandName, args: { taskSubcommand: subcommand, taskIdentifier } };
		}

		return { command: commandName, args: { taskSubcommand: subcommand } };
	}

	return { command: commandName };
}

export function CommandInput({
	onCommand,
	isRunning = false,
	helpMode = false,
	pendingCommand = null,
	onPendingCommandConsumed,
}: CommandInputProps): React.ReactElement {
	const [inputValue, setInputValue] = useState("");
	const [pastedSegments, setPastedSegments] = useState<PastedTextSegment[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [selectedHintIndex, setSelectedHintIndex] = useState(0);
	const [commandHistory, setCommandHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState<number | null>(null);
	const [savedInputValue, setSavedInputValue] = useState("");

	useEffect(() => {
		setCommandHistory(getCommandHistoryList());
	}, []);

	useEffect(() => {
		if (pendingCommand) {
			setInputValue(pendingCommand);
			setSelectedHintIndex(0);
			onPendingCommandConsumed?.();
		}
	}, [pendingCommand, onPendingCommandConsumed]);

	const isNavigatingHistory = historyIndex !== null;
	const autocomplete = getAutocompleteHint(inputValue, isRunning);
	const suggestions = autocomplete.type === "suggestions" ? (autocomplete.suggestions ?? []) : [];
	const hasSuggestions = suggestions.length > 0;

	const handleInputChange = (value: string) => {
		setInputValue(value);
		setSelectedHintIndex(0);

		if (isNavigatingHistory) {
			setHistoryIndex(null);
			setSavedInputValue("");
		}
	};

	const handlePaste = (segment: PastedTextSegment) => {
		setPastedSegments((prev) => [...prev, segment]);
	};

	const getCompletedValue = (command: SlashCommand): string => {
		const hint = COMMAND_HINTS[command];
		const hasArgs = hint.args !== undefined;

		return hasArgs ? `/${command} ` : `/${command}`;
	};

	const getCurrentPartialCommand = (): string => {
		const trimmed = inputValue.trim();

		if (!trimmed.startsWith("/")) {
			return "";
		}

		const parts = trimmed.slice(1).split(/\s+/);

		return parts.at(0)?.toLowerCase() ?? "";
	};

	const handleTabComplete = (direction: "forward" | "backward") => {
		if (!hasSuggestions) {
			return;
		}

		const currentPartial = getCurrentPartialCommand();
		const commonPrefix = autocomplete.commonPrefix ?? "";
		const isCommonPrefixComplete = currentPartial === commonPrefix.toLowerCase();

		if (suggestions.length === 1) {
			const [selectedSuggestion] = suggestions;

			if (selectedSuggestion) {
				setInputValue(getCompletedValue(selectedSuggestion.command));
				setSelectedHintIndex(0);
			}

			return;
		}

		if (!isCommonPrefixComplete && commonPrefix.length > currentPartial.length) {
			setInputValue(`/${commonPrefix}`);

			return;
		}

		if (direction === "forward") {
			const nextIndex = selectedHintIndex >= suggestions.length - 1 ? 0 : selectedHintIndex + 1;
			const selectedSuggestion = suggestions[nextIndex];

			if (selectedSuggestion) {
				setInputValue(getCompletedValue(selectedSuggestion.command));
				setSelectedHintIndex(nextIndex);
			}
		} else {
			const prevIndex = selectedHintIndex <= 0 ? suggestions.length - 1 : selectedHintIndex - 1;
			const selectedSuggestion = suggestions[prevIndex];

			if (selectedSuggestion) {
				setInputValue(getCompletedValue(selectedSuggestion.command));
				setSelectedHintIndex(prevIndex);
			}
		}
	};

	const applyAutocomplete = () => {
		handleTabComplete("forward");
	};

	const handleShiftTab = () => {
		handleTabComplete("backward");
	};

	const handleArrowUp = () => {
		if (hasSuggestions) {
			const newIndex = selectedHintIndex <= 0 ? suggestions.length - 1 : selectedHintIndex - 1;
			const selectedSuggestion = suggestions[newIndex];

			if (selectedSuggestion) {
				setInputValue(getCompletedValue(selectedSuggestion.command));
				setSelectedHintIndex(newIndex);
			}

			return;
		}

		if (commandHistory.length === 0) {
			return;
		}

		if (historyIndex === null) {
			setSavedInputValue(inputValue);
			setHistoryIndex(commandHistory.length - 1);
			setInputValue(commandHistory.at(-1) ?? "");
		} else if (historyIndex > 0) {
			const newIndex = historyIndex - 1;

			setHistoryIndex(newIndex);
			setInputValue(commandHistory[newIndex] ?? "");
		}
	};

	const handleArrowDown = () => {
		if (hasSuggestions) {
			const newIndex = selectedHintIndex >= suggestions.length - 1 ? 0 : selectedHintIndex + 1;
			const selectedSuggestion = suggestions[newIndex];

			if (selectedSuggestion) {
				setInputValue(getCompletedValue(selectedSuggestion.command));
				setSelectedHintIndex(newIndex);
			}

			return;
		}

		if (historyIndex === null) {
			return;
		}

		if (historyIndex >= commandHistory.length - 1) {
			setHistoryIndex(null);
			setInputValue(savedInputValue);
			setSavedInputValue("");
		} else {
			const newIndex = historyIndex + 1;

			setHistoryIndex(newIndex);
			setInputValue(commandHistory[newIndex] ?? "");
		}
	};

	const handleSubmit = (value: string) => {
		if (!value.trim()) {
			return;
		}

		const expandedValue = expandPastedSegments(value, pastedSegments);
		const parsed = parseSlashCommand(expandedValue);

		if (parsed) {
			if (isRunning && !RUNNING_COMMANDS.includes(parsed.command)) {
				setError(
					`Command /${parsed.command} not available while agent is running. Use /stop, /quit, or /help`,
				);
				setInputValue("");
				setPastedSegments([]);

				return;
			}

			addCommandToHistory(expandedValue);
			setCommandHistory(getCommandHistoryList());
			setError(null);
			setInputValue("");
			setPastedSegments([]);
			setSelectedHintIndex(0);
			setHistoryIndex(null);
			setSavedInputValue("");
			onCommand(parsed.command, parsed.args);
		} else {
			setError(`Unknown command: ${expandedValue}`);
			setInputValue("");
			setPastedSegments([]);
		}
	};

	const borderColor = isRunning ? "yellow" : "cyan";
	const promptColor = isRunning ? "yellow" : "cyan";
	const placeholder = isRunning ? "/stop" : "/command";
	const defaultHintText = isRunning
		? "Press Escape or type /stop to stop the agent"
		: "Enter /help for a list of commands";

	const maxSuggestions = 5;

	const renderHint = (): React.ReactElement => {
		if (isNavigatingHistory && historyIndex !== null) {
			const positionText = `${historyIndex + 1}/${commandHistory.length}`;

			return (
				<Text dimColor>History ({positionText}) — ↑↓ navigate, Enter to use, type to exit</Text>
			);
		}

		if (autocomplete.type === "argument-hint" && autocomplete.argumentHint) {
			return <Text dimColor>{autocomplete.argumentHint}</Text>;
		}

		if (hasSuggestions) {
			const windowStart = Math.max(
				0,
				Math.min(
					selectedHintIndex - Math.floor(maxSuggestions / 2),
					suggestions.length - maxSuggestions,
				),
			);
			const windowEnd = Math.min(windowStart + maxSuggestions, suggestions.length);
			const displayedSuggestions = suggestions.slice(windowStart, windowEnd);
			const itemsAbove = windowStart;
			const itemsBelow = suggestions.length - windowEnd;
			const currentPartial = getCurrentPartialCommand();
			const commonPrefix = autocomplete.commonPrefix ?? "";
			const canExpandPrefix =
				commonPrefix.length > currentPartial.length &&
				currentPartial !== commonPrefix.toLowerCase();
			const tabHint = canExpandPrefix
				? `Tab to complete "${commonPrefix}"`
				: suggestions.length > 1
					? "Tab/↑↓ to cycle"
					: "Tab to complete";

			return (
				<Box flexDirection="column">
					{itemsAbove > 0 && <Text dimColor> (+{itemsAbove} above)</Text>}
					{displayedSuggestions.map(({ command, hint }, index) => {
						const actualIndex = windowStart + index;
						const isSelected = actualIndex === selectedHintIndex;

						return (
							<Box key={command} gap={1}>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{isSelected ? "▸" : " "}
								</Text>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									/{command}
								</Text>
								{hint.args && <Text dimColor>{hint.args}</Text>}
								<Text dimColor>— {hint.description}</Text>
							</Box>
						);
					})}
					<Box gap={1}>
						{itemsBelow > 0 && <Text dimColor>(+{itemsBelow} below)</Text>}
						<Text dimColor>[{tabHint}]</Text>
					</Box>
				</Box>
			);
		}

		return <Text dimColor>{defaultHintText}</Text>;
	};

	return (
		<Box flexDirection="column">
			<Box paddingLeft={1} marginBottom={hasSuggestions ? 0 : 0}>
				{renderHint()}
			</Box>
			<Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1}>
				<Box gap={1}>
					<Text color={promptColor}>❯</Text>
					<TextInput
						value={inputValue}
						onChange={handleInputChange}
						onSubmit={handleSubmit}
						placeholder={placeholder}
						collapsePastedText
						pastedSegments={pastedSegments}
						onPaste={handlePaste}
						onArrowUp={handleArrowUp}
						onArrowDown={handleArrowDown}
						onTab={applyAutocomplete}
						onShiftTab={handleShiftTab}
						onArrowRight={applyAutocomplete}
						focus={!helpMode}
					/>
				</Box>
				{error && (
					<Box>
						<Text color="red">{error}</Text>
					</Box>
				)}
			</Box>
		</Box>
	);
}
