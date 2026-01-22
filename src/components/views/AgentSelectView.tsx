import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
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

function AgentSelectHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Select Agent
			</Text>
		</Box>
	);
}

function AgentSelectFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Escape or 'q' to cancel</Text>
		</Box>
	);
}

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
		<ResponsiveLayout
			header={<AgentSelectHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
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
					</Box>
				</ScrollableContent>
			}
			footer={<AgentSelectFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
