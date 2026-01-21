import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import {
	invalidateConfigCache,
	loadConfig,
	loadGlobalConfig,
	loadProjectConfigRaw,
	saveConfig,
	saveGlobalConfig,
} from "@/lib/config.ts";
import type { AgentType } from "@/types.ts";

interface AgentSelectViewProps {
	version: string;
	onClose: () => void;
}

const AGENT_CHOICES = [
	{ label: "Cursor", value: "cursor" as const },
	{ label: "Claude Code", value: "claude" as const },
	{ label: "Codex", value: "codex" as const },
];

const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
	cursor: "Cursor",
	claude: "Claude Code",
	codex: "Codex",
};

export function AgentSelectView({ version, onClose }: AgentSelectViewProps): React.ReactElement {
	const effectiveConfig = loadConfig();
	const [message, setMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	useInput((input, key) => {
		if (key.escape || input === "q") {
			onClose();
		}
	});

	const handleAgentSelect = (item: { value: AgentType }) => {
		const globalConfig = loadGlobalConfig();
		const projectConfigRaw = loadProjectConfigRaw();

		const updatedGlobalConfig = {
			...globalConfig,
			agent: item.value,
		};

		saveGlobalConfig(updatedGlobalConfig);

		if (projectConfigRaw !== null) {
			const updatedProjectConfig = {
				...effectiveConfig,
				agent: item.value,
			};

			saveConfig(updatedProjectConfig);
		}

		invalidateConfigCache();

		setMessage({
			type: "success",
			text: `Agent changed to ${AGENT_DISPLAY_NAMES[item.value]}`,
		});

		setTimeout(() => {
			onClose();
		}, 800);
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Select Agent
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
				<Box flexDirection="column">
					<Text bold color="yellow">
						Which AI agent do you want to use?
					</Text>
					<Text dimColor>Current: {AGENT_DISPLAY_NAMES[effectiveConfig.agent]}</Text>
				</Box>

				<Box marginTop={1}>
					<SelectInput
						items={AGENT_CHOICES}
						initialIndex={AGENT_CHOICES.findIndex(
							(choice) => choice.value === effectiveConfig.agent,
						)}
						onSelect={handleAgentSelect}
					/>
				</Box>

				{message && (
					<Box marginTop={1}>
						<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
					</Box>
				)}

				<Box marginTop={1}>
					<Text dimColor>Press Escape or 'q' to cancel</Text>
				</Box>
			</Box>
		</Box>
	);
}
