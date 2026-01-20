import { Box, Text } from "ink";
import type { AgentType } from "../types.ts";

interface HeaderProps {
	version: string;
	agent?: AgentType;
	projectName?: string;
}

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
	cursor: "Cursor",
	claude: "Claude Code",
};

export function Header({ version, agent, projectName }: HeaderProps): React.ReactElement {
	return (
		<Box flexDirection="column" paddingX={1}>
			<Box justifyContent="space-between" alignItems="flex-end">
				<Text bold color="cyan">
					{`
 ██████╗   █████╗  ██╗      ██████╗  ██╗  ██╗
 ██╔══██╗ ██╔══██╗ ██║      ██╔══██╗ ██║  ██║
 ██████╔╝ ███████║ ██║      ██████╔╝ ███████║
 ██╔══██╗ ██╔══██║ ██║      ██╔═══╝  ██╔══██║
 ██║  ██║ ██║  ██║ ███████╗ ██║      ██║  ██║
 ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚══════╝ ╚═╝      ╚═╝  ╚═╝`}
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
