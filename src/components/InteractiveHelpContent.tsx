import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface HelpCommand {
	command: string;
	description: string;
	section: string;
	executeValue: string;
}

const HELP_COMMANDS: HelpCommand[] = [
	{
		section: "Session Control",
		command: "/session start [n|full]",
		description: "Start agent loop (default: 10, full: all tasks)",
		executeValue: "/session start",
	},
	{
		section: "Session Control",
		command: "/session stop",
		description: "Stop the running agent",
		executeValue: "/session stop",
	},
	{
		section: "Session Control",
		command: "/session resume",
		description: "Resume interrupted session",
		executeValue: "/session resume",
	},
	{
		section: "Session Control",
		command: "/session pause",
		description: "Pause the current session",
		executeValue: "/session pause",
	},
	{
		section: "Session Control",
		command: "/session clear",
		description: "Clear session data",
		executeValue: "/session clear",
	},
	{
		section: "Session Control",
		command: "/session refresh",
		description: "Reload PRD from disk",
		executeValue: "/session refresh",
	},
	{
		section: "Session Control",
		command: "/session archive",
		description: "Archive completed tasks",
		executeValue: "/session archive",
	},
	{
		section: "Task Management",
		command: "/task done <id>",
		description: "Mark task as done (number or title)",
		executeValue: "/task done ",
	},
	{
		section: "Task Management",
		command: "/task undone <id>",
		description: "Mark task as pending",
		executeValue: "/task undone ",
	},
	{
		section: "Task Management",
		command: "/task current",
		description: "Show the next pending task",
		executeValue: "/task current",
	},
	{
		section: "Task Management",
		command: "/tasks",
		description: "Open the tasks view",
		executeValue: "/tasks",
	},
	{
		section: "Task Management",
		command: "/next [n|title]",
		description: "Set the next task to work on",
		executeValue: "/next ",
	},
	{
		section: "Task Management",
		command: "/add",
		description: "Add a new task (AI-generated)",
		executeValue: "/add",
	},
	{
		section: "Project Setup",
		command: "/init",
		description: "Initialize a new PRD project",
		executeValue: "/init",
	},
	{
		section: "Project Setup",
		command: "/setup",
		description: "Configure global preferences",
		executeValue: "/setup",
	},
	{
		section: "Project Setup",
		command: "/agent",
		description: "Switch coding agent",
		executeValue: "/agent",
	},
	{
		section: "Project Setup",
		command: "/projects",
		description: "View all projects",
		executeValue: "/projects",
	},
	{
		section: "Views & Info",
		command: "/status",
		description: "Show session and project status",
		executeValue: "/status",
	},
	{
		section: "Views & Info",
		command: "/guardrails",
		description: "View and manage guardrails",
		executeValue: "/guardrails",
	},
	{
		section: "Views & Info",
		command: "/memory",
		description: "View and manage session memory",
		executeValue: "/memory",
	},
	{
		section: "Views & Info",
		command: "/analyze",
		description: "View failure pattern analysis",
		executeValue: "/analyze",
	},
	{
		section: "Views & Info",
		command: "/usage",
		description: "View usage statistics",
		executeValue: "/usage",
	},
	{
		section: "Views & Info",
		command: "/config",
		description: "View effective configuration",
		executeValue: "/config",
	},
	{
		section: "Quick Actions",
		command: "/guardrail <text>",
		description: "Add a guardrail instruction",
		executeValue: "/guardrail ",
	},
	{
		section: "Quick Actions",
		command: "/rule <text>",
		description: "Add a rule instruction",
		executeValue: "/rule ",
	},
	{
		section: "Quick Actions",
		command: "/learn <lesson>",
		description: "Add a lesson to memory",
		executeValue: "/learn ",
	},
	{
		section: "Quick Actions",
		command: "/note <note>",
		description: "Add a note about current task",
		executeValue: "/note ",
	},
	{
		section: "Application",
		command: "/quit, /q",
		description: "Exit the application",
		executeValue: "/quit",
	},
	{
		section: "Application",
		command: "/exit, /e",
		description: "Exit (alias)",
		executeValue: "/exit",
	},
];

const VISIBLE_COMMANDS = 10;

interface InteractiveHelpContentProps {
	version: string;
	isActive: boolean;
	onSelectCommand: (command: string) => void;
	onClose: () => void;
}

export function InteractiveHelpContent({
	version,
	isActive,
	onSelectCommand,
	onClose,
}: InteractiveHelpContentProps): React.ReactElement {
	const [selectedIndex, setSelectedIndex] = useState(0);

	useInput(
		(_input, key) => {
			if (key.escape) {
				onClose();

				return;
			}

			if (key.upArrow) {
				setSelectedIndex((prev) => (prev <= 0 ? HELP_COMMANDS.length - 1 : prev - 1));

				return;
			}

			if (key.downArrow) {
				setSelectedIndex((prev) => (prev >= HELP_COMMANDS.length - 1 ? 0 : prev + 1));

				return;
			}

			if (key.return) {
				const selectedCommand = HELP_COMMANDS.at(selectedIndex);

				if (selectedCommand) {
					onSelectCommand(selectedCommand.executeValue);
				}
			}
		},
		{ isActive },
	);

	const totalCommands = HELP_COMMANDS.length;
	const windowStart = Math.max(
		0,
		Math.min(selectedIndex - Math.floor(VISIBLE_COMMANDS / 2), totalCommands - VISIBLE_COMMANDS),
	);
	const windowEnd = Math.min(windowStart + VISIBLE_COMMANDS, totalCommands);
	const displayedCommands = HELP_COMMANDS.slice(windowStart, windowEnd);
	const itemsAbove = windowStart;
	const itemsBelow = totalCommands - windowEnd;

	let currentSection = "";

	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			paddingY={0}
			marginY={1}
		>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Help
				</Text>
				<Text dimColor> (↑↓ navigate, Enter select, Esc close)</Text>
			</Box>

			<Box flexDirection="column">
				{itemsAbove > 0 && (
					<Text dimColor>
						{"  "}(+{itemsAbove} above)
					</Text>
				)}

				{displayedCommands.map((helpCommand, displayIndex) => {
					const actualIndex = windowStart + displayIndex;
					const isSelected = actualIndex === selectedIndex;
					const showSection = helpCommand.section !== currentSection;

					if (showSection) {
						currentSection = helpCommand.section;
					}

					const padding = Math.max(0, 24 - helpCommand.command.length);

					return (
						<Box key={`${helpCommand.section}-${helpCommand.command}`} flexDirection="column">
							{showSection && (
								<Text bold color="yellow">
									{helpCommand.section}
								</Text>
							)}
							<Box paddingLeft={2}>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{isSelected ? "▸ " : "  "}
								</Text>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{helpCommand.command}
								</Text>
								<Text>{" ".repeat(padding)}</Text>
								<Text dimColor={!isSelected}>{helpCommand.description}</Text>
							</Box>
						</Box>
					);
				})}

				{itemsBelow > 0 && (
					<Text dimColor>
						{"  "}(+{itemsBelow} below)
					</Text>
				)}
			</Box>
		</Box>
	);
}
