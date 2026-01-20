import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useState } from "react";
import { useDryRun } from "@/hooks/index.ts";
import {
	orchestrator,
	setupIterationCallbacks,
	useAgentStore,
	useAppStore,
	useIterationStore,
} from "@/stores/index.ts";
import { AddTaskWizard } from "./AddTaskWizard.tsx";
import { AgentOutput } from "./AgentOutput.tsx";
import { type CommandArgs, CommandInput, type SlashCommand } from "./CommandInput.tsx";
import { Message } from "./common/Message.tsx";
import { Header } from "./Header.tsx";
import { HelpView } from "./HelpView.tsx";
import { InitWizard } from "./InitWizard.tsx";
import { IterationProgress } from "./IterationProgress.tsx";
import { SetupWizard } from "./SetupWizard.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { TaskList } from "./TaskList.tsx";
import { UpdatePrompt } from "./UpdatePrompt.tsx";
import {
	ArchiveView,
	DryRunView,
	NotInitializedView,
	ResumePromptView,
	StatusView,
} from "./views/index.ts";

interface RunAppProps {
	version: string;
	iterations: number;
	autoResume?: boolean;
	autoStart?: boolean;
	dryRun?: boolean;
	initialTask?: string;
	maxRuntimeMs?: number;
}

export function RunApp({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
	maxRuntimeMs,
}: RunAppProps): React.ReactElement {
	const { exit } = useApp();

	const appState = useAppStore((state) => state.appState);
	const activeView = useAppStore((state) => state.activeView);
	const validationWarning = useAppStore((state) => state.validationWarning);
	const config = useAppStore((state) => state.config);
	const prd = useAppStore((state) => state.prd);
	const pendingSession = useAppStore((state) => state.pendingSession);

	const setActiveView = useAppStore((state) => state.setActiveView);
	const loadInitialState = useAppStore((state) => state.loadInitialState);
	const startIterations = useAppStore((state) => state.startIterations);
	const resumeSession = useAppStore((state) => state.resumeSession);
	const stopAgent = useAppStore((state) => state.stopAgent);
	const revalidateAndGoIdle = useAppStore((state) => state.revalidateAndGoIdle);
	const handleFatalError = useAppStore((state) => state.handleFatalError);
	const setIterations = useAppStore((state) => state.setIterations);
	const setManualNextTask = useAppStore((state) => state.setManualNextTask);

	const agentIsStreaming = useAgentStore((state) => state.isStreaming);
	const agentError = useAgentStore((state) => state.error);
	const agentStop = useAgentStore((state) => state.stop);

	const iterationCurrent = useIterationStore((state) => state.current);
	const iterationTotal = useIterationStore((state) => state.total);
	const iterationIsPaused = useIterationStore((state) => state.isPaused);
	const iterationPause = useIterationStore((state) => state.pause);
	const iterationResume = useIterationStore((state) => state.resume);

	const [nextTaskMessage, setNextTaskMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const dryRunState = useDryRun(dryRun, config, iterations);

	const handleSlashCommand = useCallback(
		(command: SlashCommand, args?: CommandArgs) => {
			switch (command) {
				case "start":
					startIterations(args?.iterations, args?.full);
					break;
				case "resume":
					resumeSession();
					break;
				case "stop":
					stopAgent();
					break;
				case "next":
					if (args?.taskIdentifier) {
						const result = setManualNextTask(args.taskIdentifier);
						if (result.success) {
							setNextTaskMessage({
								type: "success",
								text: `Next task set to: ${result.taskTitle}`,
							});
						} else {
							setNextTaskMessage({
								type: "error",
								text: result.error ?? "Failed to set next task",
							});
						}
						setTimeout(() => setNextTaskMessage(null), 5000);
					} else {
						setNextTaskMessage({ type: "error", text: "Usage: /next <task number or title>" });
						setTimeout(() => setNextTaskMessage(null), 5000);
					}
					break;
				case "init":
				case "setup":
				case "update":
				case "help":
				case "add":
				case "status":
				case "archive":
					agentStop();
					iterationPause();
					setActiveView(command === "add" ? "add" : command);
					break;
				case "quit":
				case "exit":
					exit();
					break;
			}
		},
		[
			agentStop,
			iterationPause,
			exit,
			startIterations,
			resumeSession,
			stopAgent,
			setActiveView,
			setManualNextTask,
		],
	);

	const handleViewComplete = useCallback(() => {
		setActiveView("run");
		revalidateAndGoIdle();
	}, [revalidateAndGoIdle, setActiveView]);

	const handleHelpClose = useCallback(() => {
		setActiveView("run");
		if (appState === "running" && iterationIsPaused) {
			iterationResume();
		}
	}, [appState, iterationIsPaused, iterationResume, setActiveView]);

	useInput(
		(_input, key) => {
			if (key.escape && agentIsStreaming && activeView === "run") {
				stopAgent();
			}
		},
		{ isActive: activeView === "run" },
	);

	useEffect(() => {
		setIterations(iterations);
		setupIterationCallbacks(iterations, maxRuntimeMs);
		loadInitialState(autoResume);
	}, [autoResume, iterations, loadInitialState, setIterations, maxRuntimeMs]);

	useEffect(() => {
		if (autoResume && pendingSession && appState === "idle") {
			resumeSession();
		}
	}, [autoResume, pendingSession, appState, resumeSession]);

	useEffect(() => {
		if (dryRun) return;
		if (initialTask && appState === "idle" && !pendingSession) {
			const result = setManualNextTask(initialTask);
			if (result.success) {
				setNextTaskMessage({ type: "success", text: `Task set: ${result.taskTitle}` });
				startIterations(1);
			} else {
				setNextTaskMessage({
					type: "error",
					text: result.error ?? `Failed to set task: ${initialTask}`,
				});
			}
		} else if (autoStart && !autoResume && appState === "idle" && !pendingSession) {
			startIterations();
		}
	}, [
		autoStart,
		autoResume,
		appState,
		pendingSession,
		startIterations,
		initialTask,
		setManualNextTask,
		dryRun,
	]);

	useEffect(() => {
		if (appState !== "running" || activeView !== "run") return;
		const incrementElapsedTime = useAppStore.getState().incrementElapsedTime;
		const timer = setInterval(() => incrementElapsedTime(), 1000);
		return () => clearInterval(timer);
	}, [appState, activeView]);

	useEffect(() => {
		if (agentError?.startsWith("Fatal error:") && appState === "running") {
			handleFatalError(agentError);
		}
	}, [agentError, appState, handleFatalError]);

	useEffect(() => {
		return () => {
			orchestrator.cleanup();
		};
	}, []);

	if (activeView === "init")
		return <InitWizard version={version} onComplete={handleViewComplete} />;
	if (activeView === "setup")
		return <SetupWizard version={version} onComplete={handleViewComplete} />;
	if (activeView === "update")
		return <UpdatePrompt version={version} forceCheck onComplete={handleViewComplete} />;
	if (activeView === "help") return <HelpView version={version} onClose={handleHelpClose} />;
	if (activeView === "add")
		return <AddTaskWizard version={version} onComplete={handleViewComplete} />;
	if (activeView === "status") return <StatusView version={version} onClose={handleHelpClose} />;
	if (activeView === "archive")
		return <ArchiveView version={version} onClose={handleViewComplete} />;

	if (dryRun) {
		return (
			<DryRunView
				version={version}
				config={config}
				projectName={prd?.project}
				dryRunState={dryRunState}
			/>
		);
	}

	if (appState === "not_initialized" && validationWarning) {
		return (
			<NotInitializedView
				version={version}
				validationWarning={validationWarning}
				onCommand={handleSlashCommand}
			/>
		);
	}

	if (appState === "resume_prompt" && pendingSession) {
		return (
			<ResumePromptView
				version={version}
				config={config}
				projectName={prd?.project}
				pendingSession={pendingSession}
				onCommand={handleSlashCommand}
			/>
		);
	}

	return (
		<Box flexDirection="column" minHeight={20}>
			<Header version={version} agent={config?.agent} projectName={prd?.project} />
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

			<CommandInput onCommand={handleSlashCommand} isRunning={agentIsStreaming} />
			<StatusBar />
		</Box>
	);
}
