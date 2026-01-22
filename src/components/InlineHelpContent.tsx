import { Box, Text } from "ink";

interface HelpSectionProps {
	title: string;
	children: React.ReactNode;
}

function HelpSection({ title, children }: HelpSectionProps): React.ReactElement {
	return (
		<Box flexDirection="column">
			<Text bold color="yellow">
				{title}
			</Text>
			<Box flexDirection="column" paddingLeft={2}>
				{children}
			</Box>
		</Box>
	);
}

interface HelpItemProps {
	command: string;
	description: string;
}

function HelpItem({ command, description }: HelpItemProps): React.ReactElement {
	const padding = Math.max(0, 18 - command.length);

	return (
		<Text>
			<Text dimColor>{command}</Text>
			{" ".repeat(padding)}
			<Text>{description}</Text>
		</Text>
	);
}

interface InlineHelpContentProps {
	version: string;
}

export function InlineHelpContent({ version }: InlineHelpContentProps): React.ReactElement {
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
				<Text dimColor> (press Esc or /help to close)</Text>
			</Box>

			<Box flexDirection="column" gap={1}>
				<HelpSection title="Session Control">
					<HelpItem
						command="/start [n|full]"
						description="Start agent loop (default: 10, full: all tasks)"
					/>
					<HelpItem command="/stop" description="Stop the running agent" />
					<HelpItem command="/resume" description="Resume interrupted session" />
				</HelpSection>

				<HelpSection title="Task Management">
					<HelpItem command="/task done <id>" description="Mark task as done (number or title)" />
					<HelpItem command="/task undone <id>" description="Mark task as pending" />
					<HelpItem command="/task current" description="Show the next pending task" />
					<HelpItem command="/tasks" description="Open the tasks view" />
					<HelpItem command="/next [n|title]" description="Set the next task to work on" />
					<HelpItem command="/add" description="Add a new task (AI-generated)" />
				</HelpSection>

				<HelpSection title="Project Setup">
					<HelpItem command="/init" description="Initialize a new PRD project" />
					<HelpItem command="/setup" description="Configure global preferences" />
					<HelpItem command="/agent" description="Switch coding agent" />
					<HelpItem command="/projects" description="View all projects" />
				</HelpSection>

				<HelpSection title="Views & Info">
					<HelpItem command="/status" description="Show session and project status" />
					<HelpItem command="/guardrails" description="View and manage guardrails" />
					<HelpItem command="/rules" description="View and manage rules" />
					<HelpItem command="/memory" description="View and manage session memory" />
					<HelpItem command="/analyze" description="View failure pattern analysis" />
					<HelpItem command="/usage" description="View usage statistics" />
					<HelpItem command="/config" description="View effective configuration" />
				</HelpSection>

				<HelpSection title="Quick Actions">
					<HelpItem command="/guardrail <text>" description="Add a guardrail instruction" />
					<HelpItem command="/rule <text>" description="Add a rule instruction" />
					<HelpItem command="/learn <lesson>" description="Add a lesson to memory" />
					<HelpItem command="/note <note>" description="Add a note about current task" />
					<HelpItem command="/refresh" description="Reload PRD from disk" />
				</HelpSection>

				<HelpSection title="Session Management">
					<HelpItem command="/archive" description="Archive completed tasks and progress" />
					<HelpItem command="/clear" description="Clear session data" />
					<HelpItem command="/quit, /q" description="Exit the application" />
					<HelpItem command="/exit, /e" description="Exit (alias)" />
				</HelpSection>
			</Box>
		</Box>
	);
}
