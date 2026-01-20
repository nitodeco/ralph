import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import {
	DEFAULT_ENABLE_GC_HINTS,
	DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
	DEFAULT_MEMORY_WARNING_THRESHOLD_MB,
	loadGlobalConfig,
	saveGlobalConfig,
} from "@/lib/config.ts";
import type {
	AgentType,
	MemoryConfig,
	NotificationConfig,
	PrdFormat,
	RalphConfig,
} from "@/types.ts";
import { Message } from "./common/Message.tsx";
import { TextInput } from "./common/TextInput.tsx";
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
	| "memory_buffer_size"
	| "memory_warning_threshold"
	| "memory_gc_hints"
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
	memory: MemoryConfig;
	notifications: NotificationConfig;
	webhookUrlInput: string;
	markerFilePathInput: string;
}

const AGENT_CHOICES = [
	{ label: "Cursor", value: "cursor" as const },
	{ label: "Claude Code", value: "claude" as const },
	{ label: "Codex", value: "codex" as const },
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

const MEMORY_BUFFER_SIZE_CHOICES = [
	{ label: "1 MB", value: 1 * 1024 * 1024 },
	{ label: "5 MB (default)", value: 5 * 1024 * 1024 },
	{ label: "10 MB", value: 10 * 1024 * 1024 },
	{ label: "25 MB", value: 25 * 1024 * 1024 },
	{ label: "50 MB", value: 50 * 1024 * 1024 },
];

const MEMORY_WARNING_THRESHOLD_CHOICES = [
	{ label: "250 MB", value: 250 },
	{ label: "500 MB (default)", value: 500 },
	{ label: "1 GB", value: 1024 },
	{ label: "2 GB", value: 2048 },
	{ label: "Disabled", value: 0 },
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
		memory: existingConfig.memory ?? {
			maxOutputBufferBytes: DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
			memoryWarningThresholdMb: DEFAULT_MEMORY_WARNING_THRESHOLD_MB,
			enableGarbageCollectionHints: DEFAULT_ENABLE_GC_HINTS,
		},
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
		setState((prev) => ({ ...prev, stuckThresholdMs: item.value, step: "memory_buffer_size" }));
	};

	const handleMemoryBufferSizeSelect = (item: { value: number }) => {
		setState((prev) => ({
			...prev,
			memory: { ...prev.memory, maxOutputBufferBytes: item.value },
			step: "memory_warning_threshold",
		}));
	};

	const handleMemoryWarningThresholdSelect = (item: { value: number }) => {
		setState((prev) => ({
			...prev,
			memory: {
				...prev.memory,
				memoryWarningThresholdMb: item.value === 0 ? undefined : item.value,
			},
			step: "memory_gc_hints",
		}));
	};

	const handleMemoryGcHintsSelect = (item: { value: boolean }) => {
		setState((prev) => ({
			...prev,
			memory: { ...prev.memory, enableGarbageCollectionHints: item.value },
			step: "notification_system",
		}));
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
			memory: state.memory,
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

			case "memory_buffer_size":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Maximum size for agent output buffer?</Text>
						<Text dimColor>(Larger values use more memory but preserve more output history)</Text>
						<SelectInput
							items={MEMORY_BUFFER_SIZE_CHOICES}
							initialIndex={MEMORY_BUFFER_SIZE_CHOICES.findIndex(
								(choice) =>
									choice.value ===
									(state.memory.maxOutputBufferBytes ?? DEFAULT_MAX_OUTPUT_BUFFER_BYTES),
							)}
							onSelect={handleMemoryBufferSizeSelect}
						/>
					</Box>
				);

			case "memory_warning_threshold":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Memory usage warning threshold?</Text>
						<Text dimColor>(Log warnings when heap usage exceeds this value)</Text>
						<SelectInput
							items={MEMORY_WARNING_THRESHOLD_CHOICES}
							initialIndex={MEMORY_WARNING_THRESHOLD_CHOICES.findIndex(
								(choice) =>
									choice.value ===
									(state.memory.memoryWarningThresholdMb ?? DEFAULT_MEMORY_WARNING_THRESHOLD_MB),
							)}
							onSelect={handleMemoryWarningThresholdSelect}
						/>
					</Box>
				);

			case "memory_gc_hints":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Enable garbage collection hints?</Text>
						<Text dimColor>(Suggest GC between iterations to reduce memory usage)</Text>
						<SelectInput
							items={YES_NO_CHOICES}
							initialIndex={
								(state.memory.enableGarbageCollectionHints ?? DEFAULT_ENABLE_GC_HINTS) ? 0 : 1
							}
							onSelect={handleMemoryGcHintsSelect}
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
				const agentNameMap: Record<AgentType, string> = {
					cursor: "Cursor",
					claude: "Claude Code",
					codex: "Codex",
				};
				const agentName = agentNameMap[state.agentType];
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
				const memoryBufferSizeLabel =
					MEMORY_BUFFER_SIZE_CHOICES.find(
						(choice) =>
							choice.value ===
							(state.memory.maxOutputBufferBytes ?? DEFAULT_MAX_OUTPUT_BUFFER_BYTES),
					)?.label ??
					`${Math.round((state.memory.maxOutputBufferBytes ?? DEFAULT_MAX_OUTPUT_BUFFER_BYTES) / 1024 / 1024)} MB`;
				const memoryWarningLabel =
					MEMORY_WARNING_THRESHOLD_CHOICES.find(
						(choice) =>
							choice.value ===
							(state.memory.memoryWarningThresholdMb ?? DEFAULT_MEMORY_WARNING_THRESHOLD_MB),
					)?.label ??
					(state.memory.memoryWarningThresholdMb
						? `${state.memory.memoryWarningThresholdMb} MB`
						: "Disabled");
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
								<Text dimColor>Output Buffer:</Text>{" "}
								<Text color="yellow">{memoryBufferSizeLabel}</Text>
							</Text>
							<Text>
								<Text dimColor>Memory Warning:</Text>{" "}
								<Text color="yellow">{memoryWarningLabel}</Text>
							</Text>
							<Text>
								<Text dimColor>GC Hints:</Text>{" "}
								<Text color="yellow">
									{state.memory.enableGarbageCollectionHints ? "Enabled" : "Disabled"}
								</Text>
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
