import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { loadGlobalConfig, saveGlobalConfig } from "../lib/config.ts";
import type { AgentType, PrdFormat, RalphConfig } from "../types.ts";
import { Header } from "./Header.tsx";
import { Message } from "./common/Message.tsx";

interface SetupWizardProps {
	version: string;
}

type SetupStep = "agent_type" | "prd_format" | "complete";

interface SetupState {
	step: SetupStep;
	agentType: AgentType;
	prdFormat: PrdFormat;
}

const AGENT_CHOICES = [
	{ label: "Cursor", value: "cursor" as const },
	{ label: "Claude Code", value: "claude" as const },
];

const FORMAT_CHOICES = [
	{ label: "JSON", value: "json" as const },
	{ label: "YAML", value: "yaml" as const },
];

export function SetupWizard({ version }: SetupWizardProps): React.ReactElement {
	const { exit } = useApp();
	const existingConfig = loadGlobalConfig();

	const [state, setState] = useState<SetupState>({
		step: "agent_type",
		agentType: existingConfig.agent,
		prdFormat: existingConfig.prdFormat ?? "json",
	});

	const handleAgentSelect = (item: { value: AgentType }) => {
		setState((prev) => ({ ...prev, agentType: item.value, step: "prd_format" }));
	};

	const handleFormatSelect = (item: { value: PrdFormat }) => {
		const newConfig: RalphConfig = {
			agent: state.agentType,
			prdFormat: item.value,
		};
		saveGlobalConfig(newConfig);
		setState((prev) => ({ ...prev, prdFormat: item.value, step: "complete" }));
	};

	useInput((_, key) => {
		if (state.step === "complete") {
			if (key.return || key.escape) {
				exit();
			}
		}
	});

	const renderStep = () => {
		switch (state.step) {
			case "agent_type":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Which AI agent do you want to use?</Text>
						<SelectInput
							items={AGENT_CHOICES}
							initialIndex={AGENT_CHOICES.findIndex((choice) => choice.value === state.agentType)}
							onSelect={handleAgentSelect}
						/>
					</Box>
				);

			case "prd_format":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Which format do you prefer for PRD files?</Text>
						<SelectInput
							items={FORMAT_CHOICES}
							initialIndex={FORMAT_CHOICES.findIndex((choice) => choice.value === state.prdFormat)}
							onSelect={handleFormatSelect}
						/>
					</Box>
				);

			case "complete": {
				const agentName = state.agentType === "cursor" ? "Cursor" : "Claude Code";
				const formatName = state.prdFormat.toUpperCase();
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">Setup complete!</Message>
						<Box flexDirection="column" marginTop={1}>
							<Text>
								<Text dimColor>Agent:</Text> <Text color="yellow">{agentName}</Text>
							</Text>
							<Text>
								<Text dimColor>PRD Format:</Text> <Text color="yellow">{formatName}</Text>
							</Text>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>
								Configuration saved to ~/.ralph/config.json
							</Text>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Run 'ralph init' in a project directory to get started.</Text>
						</Box>
						<Text dimColor>Press Enter to exit</Text>
					</Box>
				);
			}

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text bold>Setup Ralph</Text>
				</Box>
				{renderStep()}
			</Box>
		</Box>
	);
}
