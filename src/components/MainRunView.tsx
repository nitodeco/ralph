import { Box, Text } from "ink";
import { useState } from "react";
import type { Prd, RalphConfig } from "@/types.ts";
import { AgentStatus } from "./AgentStatus.tsx";
import type { CommandArgs, SlashCommand } from "./CommandInput.tsx";
import { CommandInput } from "./CommandInput.tsx";
import { Message } from "./common/Message.tsx";
import { ResponsiveLayout, useResponsive } from "./common/ResponsiveLayout.tsx";
import { ScrollableContent } from "./common/ScrollableContent.tsx";
import { Header } from "./Header.tsx";
import { InteractiveHelpContent } from "./InteractiveHelpContent.tsx";
import { IterationProgress } from "./IterationProgress.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { TaskList } from "./TaskList.tsx";
import { UpdateBanner } from "./UpdateBanner.tsx";

interface SlashCommandMessage {
	type: "success" | "error";
	text: string;
}

interface MainRunViewProps {
	version: string;
	config: RalphConfig | null;
	prd: Prd | null;
	appState: string;
	iterationCurrent: number;
	iterationTotal: number;
	agentIsStreaming: boolean;
	nextTaskMessage: SlashCommandMessage | null;
	guardrailMessage: SlashCommandMessage | null;
	memoryMessage: SlashCommandMessage | null;
	refreshMessage: SlashCommandMessage | null;
	clearMessage: SlashCommandMessage | null;
	taskMessage: SlashCommandMessage | null;
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	updateAvailable: boolean;
	latestVersion: string | null;
	updateBannerDismissed: boolean;
	helpVisible: boolean;
	onDismissHelp: () => void;
}

interface MessageDisplayProps {
	message: SlashCommandMessage | null;
}

function MessageDisplay({ message }: MessageDisplayProps): React.ReactElement | null {
	if (!message) {
		return null;
	}

	return (
		<Box paddingX={1} marginY={1}>
			<Message type={message.type === "success" ? "success" : "error"}>{message.text}</Message>
		</Box>
	);
}

interface HeaderSectionProps {
	version: string;
	config: RalphConfig | null;
	prd: Prd | null;
	showUpdateBanner: boolean;
	latestVersion: string | null;
}

function HeaderSection({
	version,
	config,
	prd,
	showUpdateBanner,
	latestVersion,
}: HeaderSectionProps): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return (
		<Box flexDirection="column">
			<Header
				version={version}
				agent={config?.agent}
				projectName={prd?.project}
				variant={headerVariant}
			/>
			{showUpdateBanner && latestVersion && !isNarrow && (
				<UpdateBanner currentVersion={version} latestVersion={latestVersion} />
			)}
		</Box>
	);
}

interface ContentSectionProps {
	nextTaskMessage: SlashCommandMessage | null;
	guardrailMessage: SlashCommandMessage | null;
	memoryMessage: SlashCommandMessage | null;
	refreshMessage: SlashCommandMessage | null;
	clearMessage: SlashCommandMessage | null;
	taskMessage: SlashCommandMessage | null;
	appState: string;
	iterationCurrent: number;
	iterationTotal: number;
	helpVisible: boolean;
	version: string;
	onSelectHelpCommand: (command: string) => void;
	onDismissHelp: () => void;
}

const STATES_WITH_PROGRESS_BAR = new Set(["running", "complete", "max_iterations", "max_runtime"]);

function ContentSection({
	nextTaskMessage,
	guardrailMessage,
	memoryMessage,
	refreshMessage,
	clearMessage,
	taskMessage,
	appState,
	iterationCurrent,
	iterationTotal,
	helpVisible,
	version,
	onSelectHelpCommand,
	onDismissHelp,
}: ContentSectionProps): React.ReactElement {
	const showIterationProgress = STATES_WITH_PROGRESS_BAR.has(appState);

	return (
		<ScrollableContent>
			{helpVisible && (
				<InteractiveHelpContent
					version={version}
					isActive={helpVisible}
					onSelectCommand={onSelectHelpCommand}
					onClose={onDismissHelp}
				/>
			)}

			<TaskList />
			{showIterationProgress && <IterationProgress />}
			<AgentStatus />

			<MessageDisplay message={nextTaskMessage} />
			<MessageDisplay message={guardrailMessage} />
			<MessageDisplay message={memoryMessage} />
			<MessageDisplay message={refreshMessage} />
			<MessageDisplay message={clearMessage} />
			<MessageDisplay message={taskMessage} />

			{appState === "idle" && (
				<Box paddingX={1} marginY={1}>
					<Text dimColor>
						Type <Text color="cyan">/start</Text>, <Text color="cyan">/start [n]</Text>, or{" "}
						<Text color="cyan">/start full</Text> to begin iterations
					</Text>
				</Box>
			)}

			{appState === "complete" && (
				<Box paddingX={1} marginY={1}>
					<Message type="success">All tasks completed!</Message>
				</Box>
			)}

			{appState === "max_iterations" && (
				<Box paddingX={1} marginY={1}>
					<Message type="warning">
						Completed {iterationTotal} iterations. PRD is not completed.
					</Message>
				</Box>
			)}

			{appState === "max_runtime" && (
				<Box paddingX={1} marginY={1}>
					<Message type="warning">
						Max runtime limit reached. Stopped after {iterationCurrent} iterations.
					</Message>
				</Box>
			)}
		</ScrollableContent>
	);
}

interface FooterSectionProps {
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	agentIsStreaming: boolean;
	helpMode: boolean;
	pendingCommand: string | null;
	onPendingCommandConsumed: () => void;
}

function FooterSection({
	onCommand,
	agentIsStreaming,
	helpMode,
	pendingCommand,
	onPendingCommandConsumed,
}: FooterSectionProps): React.ReactElement {
	return (
		<Box flexDirection="column">
			<CommandInput
				onCommand={onCommand}
				isRunning={agentIsStreaming}
				helpMode={helpMode}
				pendingCommand={pendingCommand}
				onPendingCommandConsumed={onPendingCommandConsumed}
			/>
			<StatusBar />
		</Box>
	);
}

export function MainRunView({
	version,
	config,
	prd,
	appState,
	iterationCurrent,
	iterationTotal,
	agentIsStreaming,
	nextTaskMessage,
	guardrailMessage,
	memoryMessage,
	refreshMessage,
	clearMessage,
	taskMessage,
	onCommand,
	updateAvailable,
	latestVersion,
	updateBannerDismissed,
	helpVisible,
	onDismissHelp,
}: MainRunViewProps): React.ReactElement {
	const showUpdateBanner = Boolean(updateAvailable && latestVersion && !updateBannerDismissed);
	const [pendingCommand, setPendingCommand] = useState<string | null>(null);

	const handleSelectHelpCommand = (command: string) => {
		setPendingCommand(command);
		onDismissHelp();
	};

	const handlePendingCommandConsumed = () => {
		setPendingCommand(null);
	};

	return (
		<ResponsiveLayout
			header={
				<HeaderSection
					version={version}
					config={config}
					prd={prd}
					showUpdateBanner={showUpdateBanner}
					latestVersion={latestVersion}
				/>
			}
			content={
				<ContentSection
					nextTaskMessage={nextTaskMessage}
					guardrailMessage={guardrailMessage}
					memoryMessage={memoryMessage}
					refreshMessage={refreshMessage}
					clearMessage={clearMessage}
					taskMessage={taskMessage}
					appState={appState}
					iterationCurrent={iterationCurrent}
					iterationTotal={iterationTotal}
					helpVisible={helpVisible}
					version={version}
					onSelectHelpCommand={handleSelectHelpCommand}
					onDismissHelp={onDismissHelp}
				/>
			}
			footer={
				<FooterSection
					onCommand={onCommand}
					agentIsStreaming={agentIsStreaming}
					helpMode={helpVisible}
					pendingCommand={pendingCommand}
					onPendingCommandConsumed={handlePendingCommandConsumed}
				/>
			}
		/>
	);
}
