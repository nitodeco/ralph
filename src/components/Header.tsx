import { Box, Text } from "ink";
import type { AgentType } from "@/types.ts";

type HeaderVariant = "full" | "compact" | "minimal";

interface HeaderProps {
	version: string;
	agent?: AgentType;
	projectName?: string;
	variant?: HeaderVariant;
}

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
	cursor: "Cursor",
	claude: "Claude Code",
	codex: "Codex",
};

const FULL_LOGO = `
 ██████╗   █████╗  ██╗      ██████╗  ██╗  ██╗
 ██╔══██╗ ██╔══██╗ ██║      ██╔══██╗ ██║  ██║
 ██████╔╝ ███████║ ██║      ██████╔╝ ███████║
 ██╔══██╗ ██╔══██║ ██║      ██╔═══╝  ██╔══██║
 ██║  ██║ ██║  ██║ ███████╗ ██║      ██║  ██║
 ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚══════╝ ╚═╝      ╚═╝  ╚═╝`;

function FullHeader({
	version,
	agent,
	projectName,
}: Omit<HeaderProps, "variant">): React.ReactElement {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Box justifyContent="space-between" alignItems="flex-end">
				<Text bold color="cyan">
					{FULL_LOGO}
				</Text>
				<Text dimColor>v{version}</Text>
			</Box>
			{(agent || projectName) && (
				<Box gap={2} marginTop={1}>
					{agent && (
						<Text>
							<Text dimColor>agent:</Text> <Text color="yellow">{AGENT_DISPLAY_NAMES[agent]}</Text>
						</Text>
					)}
					{projectName && (
						<Text>
							<Text dimColor>project:</Text> <Text>{projectName}</Text>
						</Text>
					)}
				</Box>
			)}
		</Box>
	);
}

function CompactHeader({
	version,
	agent,
	projectName,
}: Omit<HeaderProps, "variant">): React.ReactElement {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="cyan">
				{FULL_LOGO}
			</Text>
			<Box gap={2}>
				<Text dimColor>v{version}</Text>
				{agent && (
					<Text>
						<Text dimColor>agent:</Text> <Text color="yellow">{AGENT_DISPLAY_NAMES[agent]}</Text>
					</Text>
				)}
				{projectName && (
					<Text>
						<Text dimColor>project:</Text> <Text>{projectName}</Text>
					</Text>
				)}
			</Box>
		</Box>
	);
}

function MinimalHeader({
	version,
	agent,
	projectName,
}: Omit<HeaderProps, "variant">): React.ReactElement {
	return (
		<Box paddingX={1} gap={2}>
			<Text bold color="cyan">
				◆ ralph
			</Text>
			<Text dimColor>v{version}</Text>
			{agent && (
				<Text>
					<Text color="yellow">{AGENT_DISPLAY_NAMES[agent]}</Text>
				</Text>
			)}
			{projectName && <Text dimColor>{projectName}</Text>}
		</Box>
	);
}

export function Header({
	version,
	agent,
	projectName,
	variant = "full",
}: HeaderProps): React.ReactElement {
	if (variant === "minimal") {
		return <MinimalHeader version={version} agent={agent} projectName={projectName} />;
	}

	if (variant === "compact") {
		return <CompactHeader version={version} agent={agent} projectName={projectName} />;
	}

	return <FullHeader version={version} agent={agent} projectName={projectName} />;
}
