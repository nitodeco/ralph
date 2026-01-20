import { Box, Text } from "ink";
import type { Prd, RalphConfig } from "@/types/index.ts";
import { AgentOutput } from "./AgentOutput.tsx";
import type { CommandArgs, SlashCommand } from "./CommandInput.tsx";
import { CommandInput } from "./CommandInput.tsx";
import { Message } from "./common/Message.tsx";
import { Header } from "./Header.tsx";
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
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
	updateAvailable: boolean;
	latestVersion: string | null;
	updateBannerDismissed: boolean;
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
	onCommand,
	updateAvailable,
	latestVersion,
	updateBannerDismissed,
}: MainRunViewProps): React.ReactElement {
	const showUpdateBanner = updateAvailable && latestVersion && !updateBannerDismissed;

	return (
		<Box flexDirection="column" minHeight={20}>
			<Header version={version} agent={config?.agent} projectName={prd?.project} />
			{showUpdateBanner && <UpdateBanner currentVersion={version} latestVersion={latestVersion} />}
			<TaskList />
			<IterationProgress />
			<AgentOutput />

			{nextTaskMessage && (
				<Box paddingX={1} marginY={1}>
					<Message type={nextTaskMessage.type === "success" ? "success" : "error"}>
						{nextTaskMessage.text}
					</Message>
				</Box>
			)}

			{guardrailMessage && (
				<Box paddingX={1} marginY={1}>
					<Message type={guardrailMessage.type === "success" ? "success" : "error"}>
						{guardrailMessage.text}
					</Message>
				</Box>
			)}

			{memoryMessage && (
				<Box paddingX={1} marginY={1}>
					<Message type={memoryMessage.type === "success" ? "success" : "error"}>
						{memoryMessage.text}
					</Message>
				</Box>
			)}

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

			<CommandInput onCommand={onCommand} isRunning={agentIsStreaming} />
			<StatusBar />
		</Box>
	);
}
