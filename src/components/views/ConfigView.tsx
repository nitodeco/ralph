import { Box, Text, useInput } from "ink";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import {
	CONFIG_DEFAULTS,
	formatBytes,
	formatMs,
	getEffectiveConfig,
	getGlobalConfigPath,
	getProjectConfigPath,
} from "@/lib/config.ts";
import type { RalphConfig } from "@/types.ts";

interface ConfigViewProps {
	version: string;
	onClose: () => void;
}

function ConfigHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Configuration
			</Text>
		</Box>
	);
}

function ConfigFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Enter, Escape, or 'q' to close • /setup to reconfigure</Text>
		</Box>
	);
}

function ConfigSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<Box flexDirection="column">
			<Text bold color="yellow">
				{title}:
			</Text>
			<Box flexDirection="column" paddingLeft={2}>
				{children}
			</Box>
		</Box>
	);
}

function ConfigItem({
	label,
	value,
	dimValue,
}: {
	label: string;
	value: string;
	dimValue?: boolean;
}): React.ReactElement {
	return (
		<Text>
			<Text dimColor>{label}:</Text>{" "}
			<Text color={dimValue ? undefined : "cyan"} dimColor={dimValue}>
				{value}
			</Text>
		</Text>
	);
}

function renderAgentSettings(config: RalphConfig): React.ReactElement {
	const agentNameByAgentType: Record<string, string> = {
		cursor: "Cursor",
		claude: "Claude Code",
		codex: "Codex",
	};

	return (
		<ConfigSection title="Agent Settings">
			<ConfigItem label="Agent" value={agentNameByAgentType[config.agent] ?? config.agent} />
		</ConfigSection>
	);
}

function renderRetrySettings(config: RalphConfig): React.ReactElement {
	return (
		<ConfigSection title="Retry Settings">
			<ConfigItem
				label="Max Retries"
				value={String(config.maxRetries ?? CONFIG_DEFAULTS.maxRetries)}
			/>
			<ConfigItem
				label="Retry Delay"
				value={formatMs(config.retryDelayMs ?? CONFIG_DEFAULTS.retryDelayMs)}
			/>
		</ConfigSection>
	);
}

function renderTimeoutSettings(config: RalphConfig): React.ReactElement {
	const agentTimeoutValue =
		config.agentTimeoutMs === 0
			? "disabled"
			: formatMs(config.agentTimeoutMs ?? CONFIG_DEFAULTS.agentTimeoutMs);
	const stuckThresholdValue =
		config.stuckThresholdMs === 0
			? "disabled"
			: formatMs(config.stuckThresholdMs ?? CONFIG_DEFAULTS.stuckThresholdMs);

	return (
		<ConfigSection title="Timeout Settings">
			<ConfigItem label="Agent Timeout" value={agentTimeoutValue} />
			<ConfigItem label="Stuck Threshold" value={stuckThresholdValue} />
		</ConfigSection>
	);
}

function renderNotificationSettings(config: RalphConfig): React.ReactElement {
	const notifications = config.notifications ?? CONFIG_DEFAULTS.notifications;

	return (
		<ConfigSection title="Notifications">
			<ConfigItem
				label="System Notify"
				value={notifications.systemNotification ? "enabled" : "disabled"}
			/>
			<ConfigItem
				label="Webhook URL"
				value={notifications.webhookUrl ?? "not set"}
				dimValue={!notifications.webhookUrl}
			/>
			<ConfigItem
				label="Marker File"
				value={notifications.markerFilePath ?? "not set"}
				dimValue={!notifications.markerFilePath}
			/>
		</ConfigSection>
	);
}

function renderMemorySettings(config: RalphConfig): React.ReactElement {
	const memory = config.memory ?? CONFIG_DEFAULTS.memory;
	const maxOutputBufferBytes =
		memory.maxOutputBufferBytes ?? CONFIG_DEFAULTS.memory.maxOutputBufferBytes ?? 0;
	const memoryWarningValue =
		memory.memoryWarningThresholdMb === 0
			? "disabled"
			: `${memory.memoryWarningThresholdMb ?? CONFIG_DEFAULTS.memory.memoryWarningThresholdMb} MB`;

	return (
		<ConfigSection title="Memory Management">
			<ConfigItem label="Output Buffer" value={formatBytes(maxOutputBufferBytes)} />
			<ConfigItem label="Memory Warning" value={memoryWarningValue} />
			<ConfigItem
				label="GC Hints"
				value={memory.enableGarbageCollectionHints !== false ? "enabled" : "disabled"}
			/>
		</ConfigSection>
	);
}

function renderGitProviderSettings(config: RalphConfig): React.ReactElement {
	const gitProvider = config.gitProvider;
	const hasGitHubToken = gitProvider?.github?.token !== undefined;

	return (
		<ConfigSection title="Git Provider">
			<ConfigItem
				label="GitHub Token"
				value={hasGitHubToken ? "configured" : "not set"}
				dimValue={!hasGitHubToken}
			/>
			<ConfigItem
				label="Auto Create PR"
				value={gitProvider?.autoCreatePr ? "enabled" : "disabled"}
			/>
			<ConfigItem label="PR Draft Mode" value={gitProvider?.prDraft ? "enabled" : "disabled"} />
			{gitProvider?.prLabels && gitProvider.prLabels.length > 0 && (
				<ConfigItem label="PR Labels" value={gitProvider.prLabels.join(", ")} />
			)}
			{gitProvider?.prReviewers && gitProvider.prReviewers.length > 0 && (
				<ConfigItem label="PR Reviewers" value={gitProvider.prReviewers.join(", ")} />
			)}
		</ConfigSection>
	);
}

export function ConfigView({ version, onClose }: ConfigViewProps): React.ReactElement {
	useInput((input, key) => {
		if (key.escape || key.return || input === "q") {
			onClose();
		}
	});

	const { global: globalConfig, project: projectConfig, effective } = getEffectiveConfig();

	return (
		<ResponsiveLayout
			header={<ConfigHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
						<ConfigSection title="Config Files">
							<ConfigItem
								label="Global"
								value={`${getGlobalConfigPath()} ${globalConfig ? "(exists)" : "(not found)"}`}
							/>
							<ConfigItem
								label="Project"
								value={`${getProjectConfigPath()} ${projectConfig ? "(exists)" : "(not found)"}`}
							/>
						</ConfigSection>

						{renderAgentSettings(effective)}
						{renderRetrySettings(effective)}
						{renderTimeoutSettings(effective)}
						{renderNotificationSettings(effective)}
						{renderMemorySettings(effective)}
						{renderGitProviderSettings(effective)}

						<Box marginTop={1}>
							<Text dimColor>
								Run /setup to reconfigure settings or /github to configure GitHub integration.
							</Text>
						</Box>
					</Box>
				</ScrollableContent>
			}
			footer={<ConfigFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
