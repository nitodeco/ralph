import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import { useState } from "react";
import { loadGlobalConfig, saveGlobalConfig } from "../lib/config.ts";
import type { AgentType, NotificationConfig, PrdFormat, RalphConfig } from "../types.ts";
import { Message } from "./common/Message.tsx";
import { Header } from "./Header.tsx";

interface SetupWizardProps {
	version: string;
	onComplete?: () => void;
}

type SetupStep =
	| "agent_type"
	| "prd_format"
	| "max_retries"
	| "retry_delay"
	| "agent_timeout"
	| "stuck_threshold"
	| "notification_system"
	| "notification_webhook"
	| "notification_marker"
	| "complete";

interface SetupState {
	step: SetupStep;
	agentType: AgentType;
	prdFormat: PrdFormat;
	maxRetries: number;
	retryDelayMs: number;
	agentTimeoutMs: number;
	stuckThresholdMs: number;
	notifications: NotificationConfig;
	webhookUrlInput: string;
	markerFilePathInput: string;
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

const AGENT_TIMEOUT_CHOICES = [
	{ label: "10 minutes", value: 10 * 60 * 1000 },
	{ label: "30 minutes (default)", value: 30 * 60 * 1000 },
	{ label: "1 hour", value: 60 * 60 * 1000 },
	{ label: "2 hours", value: 2 * 60 * 60 * 1000 },
	{ label: "No timeout", value: 0 },
];

const STUCK_THRESHOLD_CHOICES = [
	{ label: "2 minutes", value: 2 * 60 * 1000 },
	{ label: "5 minutes (default)", value: 5 * 60 * 1000 },
	{ label: "10 minutes", value: 10 * 60 * 1000 },
	{ label: "30 minutes", value: 30 * 60 * 1000 },
	{ label: "No stuck detection", value: 0 },
];

const YES_NO_CHOICES = [
	{ label: "Yes", value: true },
	{ label: "No", value: false },
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
		agentTimeoutMs: existingConfig.agentTimeoutMs ?? 30 * 60 * 1000,
		stuckThresholdMs: existingConfig.stuckThresholdMs ?? 5 * 60 * 1000,
		notifications: existingConfig.notifications ?? {},
		webhookUrlInput: existingConfig.notifications?.webhookUrl ?? "",
		markerFilePathInput: existingConfig.notifications?.markerFilePath ?? "",
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
		setState((prev) => ({ ...prev, retryDelayMs: item.value, step: "agent_timeout" }));
	};

	const handleAgentTimeoutSelect = (item: { value: number }) => {
		setState((prev) => ({ ...prev, agentTimeoutMs: item.value, step: "stuck_threshold" }));
	};

	const handleStuckThresholdSelect = (item: { value: number }) => {
		setState((prev) => ({ ...prev, stuckThresholdMs: item.value, step: "notification_system" }));
	};

	const handleSystemNotificationSelect = (item: { value: boolean }) => {
		setState((prev) => ({
			...prev,
			notifications: { ...prev.notifications, systemNotification: item.value },
			step: "notification_webhook",
		}));
	};

	const handleWebhookUrlSubmit = () => {
		const webhookUrl = state.webhookUrlInput.trim() || undefined;
		setState((prev) => ({
			...prev,
			notifications: { ...prev.notifications, webhookUrl },
			step: "notification_marker",
		}));
	};

	const handleMarkerFilePathSubmit = () => {
		const markerFilePath = state.markerFilePathInput.trim() || undefined;
		const finalNotifications: NotificationConfig = {
			...state.notifications,
			markerFilePath,
		};
		const newConfig: RalphConfig = {
			agent: state.agentType,
			prdFormat: state.prdFormat,
			maxRetries: state.maxRetries,
			retryDelayMs: state.retryDelayMs,
			agentTimeoutMs: state.agentTimeoutMs,
			stuckThresholdMs: state.stuckThresholdMs,
			notifications: finalNotifications,
		};
		saveGlobalConfig(newConfig);
		setState((prev) => ({
			...prev,
			notifications: finalNotifications,
			step: "complete",
		}));
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
							initialIndex={MAX_RETRIES_CHOICES.findIndex(
								(choice) => choice.value === state.maxRetries,
							)}
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
							initialIndex={RETRY_DELAY_CHOICES.findIndex(
								(choice) => choice.value === state.retryDelayMs,
							)}
							onSelect={handleRetryDelaySelect}
						/>
					</Box>
				);

			case "agent_timeout":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Maximum time for agent execution?</Text>
						<Text dimColor>(Agent will be killed and retried if it exceeds this time)</Text>
						<SelectInput
							items={AGENT_TIMEOUT_CHOICES}
							initialIndex={AGENT_TIMEOUT_CHOICES.findIndex(
								(choice) => choice.value === state.agentTimeoutMs,
							)}
							onSelect={handleAgentTimeoutSelect}
						/>
					</Box>
				);

			case "stuck_threshold":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">How long to wait before considering agent stuck?</Text>
						<Text dimColor>(Agent will be killed if no output for this duration)</Text>
						<SelectInput
							items={STUCK_THRESHOLD_CHOICES}
							initialIndex={STUCK_THRESHOLD_CHOICES.findIndex(
								(choice) => choice.value === state.stuckThresholdMs,
							)}
							onSelect={handleStuckThresholdSelect}
						/>
					</Box>
				);

			case "notification_system":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Enable macOS system notifications?</Text>
						<Text dimColor>(Get notified when tasks complete, fail, or reach max iterations)</Text>
						<SelectInput
							items={YES_NO_CHOICES}
							initialIndex={state.notifications.systemNotification ? 0 : 1}
							onSelect={handleSystemNotificationSelect}
						/>
					</Box>
				);

			case "notification_webhook":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Webhook URL for notifications (optional):</Text>
						<Text dimColor>(Leave empty to skip. POST requests will be sent on events)</Text>
						<Box>
							<Text color="gray">URL: </Text>
							<TextInput
								value={state.webhookUrlInput}
								onChange={(value) => setState((prev) => ({ ...prev, webhookUrlInput: value }))}
								onSubmit={handleWebhookUrlSubmit}
								placeholder="https://example.com/webhook"
							/>
						</Box>
						<Text dimColor>Press Enter to continue</Text>
					</Box>
				);

			case "notification_marker":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Marker file path for notifications (optional):</Text>
						<Text dimColor>(Leave empty to skip. A JSON file will be written on events)</Text>
						<Box>
							<Text color="gray">Path: </Text>
							<TextInput
								value={state.markerFilePathInput}
								onChange={(value) => setState((prev) => ({ ...prev, markerFilePathInput: value }))}
								onSubmit={handleMarkerFilePathSubmit}
								placeholder="/path/to/marker.json"
							/>
						</Box>
						<Text dimColor>Press Enter to continue</Text>
					</Box>
				);

			case "complete": {
				const agentName = state.agentType === "cursor" ? "Cursor" : "Claude Code";
				const formatName = state.prdFormat.toUpperCase();
				const retryDelayLabel =
					RETRY_DELAY_CHOICES.find((choice) => choice.value === state.retryDelayMs)?.label ??
					`${state.retryDelayMs}ms`;
				const agentTimeoutLabel =
					AGENT_TIMEOUT_CHOICES.find((choice) => choice.value === state.agentTimeoutMs)?.label ??
					(state.agentTimeoutMs === 0
						? "No timeout"
						: `${Math.round(state.agentTimeoutMs / 60000)} minutes`);
				const stuckThresholdLabel =
					STUCK_THRESHOLD_CHOICES.find((choice) => choice.value === state.stuckThresholdMs)
						?.label ??
					(state.stuckThresholdMs === 0
						? "No stuck detection"
						: `${Math.round(state.stuckThresholdMs / 60000)} minutes`);
				const hasNotifications =
					state.notifications.systemNotification ||
					state.notifications.webhookUrl ||
					state.notifications.markerFilePath;
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
							<Text>
								<Text dimColor>Agent Timeout:</Text> <Text color="yellow">{agentTimeoutLabel}</Text>
							</Text>
							<Text>
								<Text dimColor>Stuck Threshold:</Text>{" "}
								<Text color="yellow">{stuckThresholdLabel}</Text>
							</Text>
							<Text>
								<Text dimColor>Notifications:</Text>{" "}
								<Text color="yellow">{hasNotifications ? "Enabled" : "Disabled"}</Text>
							</Text>
							{state.notifications.systemNotification && (
								<Text>
									<Text dimColor> - System:</Text> <Text color="green">On</Text>
								</Text>
							)}
							{state.notifications.webhookUrl && (
								<Text>
									<Text dimColor> - Webhook:</Text>{" "}
									<Text color="green">{state.notifications.webhookUrl}</Text>
								</Text>
							)}
							{state.notifications.markerFilePath && (
								<Text>
									<Text dimColor> - Marker File:</Text>{" "}
									<Text color="green">{state.notifications.markerFilePath}</Text>
								</Text>
							)}
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Configuration saved to ~/.ralph/config.json</Text>
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
