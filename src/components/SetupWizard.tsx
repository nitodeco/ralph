import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { loadGlobalConfig, saveGlobalConfig } from "../lib/config.ts";
import type { AgentType, PrdFormat, RalphConfig } from "../types.ts";
import { Header } from "./Header.tsx";
import { Message } from "./common/Message.tsx";

interface SetupWizardProps {
	version: string;
	onComplete?: () => void;
}

type SetupStep = "agent_type" | "prd_format" | "max_retries" | "retry_delay" | "complete";

interface SetupState {
	step: SetupStep;
	agentType: AgentType;
	prdFormat: PrdFormat;
	maxRetries: number;
	retryDelayMs: number;
}

const AGENT_CHOICES = [
	{ label: "Cursor", value: "cursor" as const },
	{ label: "Claude Code", value: "claude" as const },
];

const FORMAT_CHOICES = [
	{ label: "JSON", value: "json" as const },
	{ label: "YAML", value: "yaml" as const },
];

const MAX_RETRIES_CHOICES = [
	{ label: "0 (No retries)", value: 0 },
	{ label: "1 retry", value: 1 },
	{ label: "3 retries (default)", value: 3 },
	{ label: "5 retries", value: 5 },
	{ label: "10 retries", value: 10 },
];

const RETRY_DELAY_CHOICES = [
	{ label: "1 second", value: 1000 },
	{ label: "5 seconds (default)", value: 5000 },
	{ label: "10 seconds", value: 10000 },
	{ label: "30 seconds", value: 30000 },
	{ label: "1 minute", value: 60000 },
];

export function SetupWizard({ version, onComplete }: SetupWizardProps): React.ReactElement {
	const { exit } = useApp();
	const existingConfig = loadGlobalConfig();

	const handleExit = () => {
		if (onComplete) {
			onComplete();
		} else {
			exit();
		}
	};

	const [state, setState] = useState<SetupState>({
		step: "agent_type",
		agentType: existingConfig.agent,
		prdFormat: existingConfig.prdFormat ?? "json",
		maxRetries: existingConfig.maxRetries ?? 3,
		retryDelayMs: existingConfig.retryDelayMs ?? 5000,
	});

	const handleAgentSelect = (item: { value: AgentType }) => {
		setState((prev) => ({ ...prev, agentType: item.value, step: "prd_format" }));
	};

	const handleFormatSelect = (item: { value: PrdFormat }) => {
		setState((prev) => ({ ...prev, prdFormat: item.value, step: "max_retries" }));
	};

	const handleMaxRetriesSelect = (item: { value: number }) => {
		setState((prev) => ({ ...prev, maxRetries: item.value, step: "retry_delay" }));
	};

	const handleRetryDelaySelect = (item: { value: number }) => {
		const newConfig: RalphConfig = {
			agent: state.agentType,
			prdFormat: state.prdFormat,
			maxRetries: state.maxRetries,
			retryDelayMs: item.value,
		};
		saveGlobalConfig(newConfig);
		setState((prev) => ({ ...prev, retryDelayMs: item.value, step: "complete" }));
	};

	useInput((_, key) => {
		if (state.step === "complete") {
			if (key.return || key.escape) {
				handleExit();
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

			case "max_retries":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">How many times should Ralph retry on agent failures?</Text>
						<SelectInput
							items={MAX_RETRIES_CHOICES}
							initialIndex={MAX_RETRIES_CHOICES.findIndex((choice) => choice.value === state.maxRetries)}
							onSelect={handleMaxRetriesSelect}
						/>
					</Box>
				);

			case "retry_delay":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">How long should Ralph wait before retrying?</Text>
						<Text dimColor>(Uses exponential backoff - this is the base delay)</Text>
						<SelectInput
							items={RETRY_DELAY_CHOICES}
							initialIndex={RETRY_DELAY_CHOICES.findIndex((choice) => choice.value === state.retryDelayMs)}
							onSelect={handleRetryDelaySelect}
						/>
					</Box>
				);

			case "complete": {
				const agentName = state.agentType === "cursor" ? "Cursor" : "Claude Code";
				const formatName = state.prdFormat.toUpperCase();
				const retryDelayLabel = RETRY_DELAY_CHOICES.find((choice) => choice.value === state.retryDelayMs)?.label ?? `${state.retryDelayMs}ms`;
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
							<Text>
								<Text dimColor>Max Retries:</Text> <Text color="yellow">{state.maxRetries}</Text>
							</Text>
							<Text>
								<Text dimColor>Retry Delay:</Text> <Text color="yellow">{retryDelayLabel}</Text>
							</Text>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>
								Configuration saved to ~/.ralph/config.json
							</Text>
						</Box>
						{onComplete ? (
							<Text dimColor>Press Enter to continue</Text>
						) : (
							<>
								<Box marginTop={1}>
									<Text dimColor>Run 'ralph init' in a project directory to get started.</Text>
								</Box>
								<Text dimColor>Press Enter to exit</Text>
							</>
						)}
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
