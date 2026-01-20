import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect } from "react";
import {
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

interface RunAppProps {
	version: string;
	iterations: number;
	autoResume?: boolean;
	autoStart?: boolean;
}

export function RunApp({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
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
	const handleAgentComplete = useAppStore((state) => state.handleAgentComplete);
	const handleFatalError = useAppStore((state) => state.handleFatalError);
	const setIterations = useAppStore((state) => state.setIterations);

	const agentIsStreaming = useAgentStore((state) => state.isStreaming);
	const agentError = useAgentStore((state) => state.error);
	const agentExitCode = useAgentStore((state) => state.exitCode);
	const agentStart = useAgentStore((state) => state.start);
	const agentStop = useAgentStore((state) => state.stop);

	const iterationCurrent = useIterationStore((state) => state.current);
	const iterationTotal = useIterationStore((state) => state.total);
	const iterationIsRunning = useIterationStore((state) => state.isRunning);
	const iterationIsDelaying = useIterationStore((state) => state.isDelaying);
	const iterationIsPaused = useIterationStore((state) => state.isPaused);
	const iterationPause = useIterationStore((state) => state.pause);
	const iterationResume = useIterationStore((state) => state.resume);

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
				case "init":
					agentStop();
					iterationPause();
					setActiveView("init");
					break;
				case "setup":
					agentStop();
					iterationPause();
					setActiveView("setup");
					break;
				case "update":
					agentStop();
					iterationPause();
					setActiveView("update");
					break;
				case "help":
					agentStop();
					iterationPause();
					setActiveView("help");
					break;
				case "add":
					agentStop();
					iterationPause();
					setActiveView("add");
					break;
				case "quit":
				case "exit":
					exit();
					break;
			}
		},
		[agentStop, iterationPause, exit, startIterations, resumeSession, stopAgent, setActiveView],
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
		setupIterationCallbacks(iterations);
		loadInitialState(autoResume);
	}, [autoResume, iterations, loadInitialState, setIterations]);

	useEffect(() => {
		if (autoResume && pendingSession && appState === "idle") {
			resumeSession();
		}
	}, [autoResume, pendingSession, appState, resumeSession]);

	useEffect(() => {
		if (autoStart && !autoResume && appState === "idle" && !pendingSession) {
			startIterations();
		}
	}, [autoStart, autoResume, appState, pendingSession, startIterations]);

	useEffect(() => {
		if (iterationIsRunning && iterationCurrent > 0 && !agentIsStreaming && !iterationIsDelaying) {
			agentStart();
		}
	}, [iterationIsRunning, iterationCurrent, iterationIsDelaying, agentIsStreaming, agentStart]);

	useEffect(() => {
		if (!agentIsStreaming && agentExitCode !== null) {
			handleAgentComplete();
		}
	}, [agentIsStreaming, agentExitCode, handleAgentComplete]);

	useEffect(() => {
		if (appState !== "running" || activeView !== "run") return;

		const incrementElapsedTime = useAppStore.getState().incrementElapsedTime;
		const timer = setInterval(() => {
			incrementElapsedTime();
		}, 1000);

		return () => clearInterval(timer);
	}, [appState, activeView]);

	useEffect(() => {
		if (agentError?.startsWith("Fatal error:") && appState === "running") {
			handleFatalError(agentError);
		}
	}, [agentError, appState, handleFatalError]);

	if (activeView === "init") {
		return <InitWizard version={version} onComplete={handleViewComplete} />;
	}

	if (activeView === "setup") {
		return <SetupWizard version={version} onComplete={handleViewComplete} />;
	}

	if (activeView === "update") {
		return <UpdatePrompt version={version} forceCheck onComplete={handleViewComplete} />;
	}

	if (activeView === "help") {
		return <HelpView version={version} onClose={handleHelpClose} />;
	}

	if (activeView === "add") {
		return <AddTaskWizard version={version} onComplete={handleViewComplete} />;
	}

	if (appState === "not_initialized" && validationWarning) {
		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} />
				<Box flexDirection="column" marginY={1} paddingX={1}>
					<Message type="warning">{validationWarning.message}</Message>
					<Text dimColor>{validationWarning.hint}</Text>
				</Box>
				<CommandInput onCommand={handleSlashCommand} />
			</Box>
		);
	}

	if (appState === "resume_prompt" && pendingSession) {
		const formatElapsedTime = (seconds: number) => {
			const hours = Math.floor(seconds / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			const secs = seconds % 60;
			if (hours > 0) {
				return `${hours}h ${minutes}m ${secs}s`;
			}
			if (minutes > 0) {
				return `${minutes}m ${secs}s`;
			}
			return `${secs}s`;
		};

		const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;

		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} agent={config?.agent} projectName={prd?.project} />
				<Box flexDirection="column" marginY={1} paddingX={1} gap={1}>
					<Message type="info">Found an existing session</Message>
					<Box flexDirection="column" paddingLeft={2}>
						<Text>
							<Text dimColor>Iterations completed:</Text>{" "}
							<Text color="cyan">{pendingSession.currentIteration}</Text>
							<Text dimColor> / </Text>
							<Text>{pendingSession.totalIterations}</Text>
						</Text>
						<Text>
							<Text dimColor>Elapsed time:</Text>{" "}
							<Text color="cyan">{formatElapsedTime(pendingSession.elapsedTimeSeconds)}</Text>
						</Text>
						<Text>
							<Text dimColor>Remaining iterations:</Text>{" "}
							<Text color="cyan">{remainingIterations > 0 ? remainingIterations : 0}</Text>
						</Text>
					</Box>
					<Box marginTop={1}>
						<Text>
							Type <Text color="cyan">/resume</Text> to continue or{" "}
							<Text color="yellow">/start</Text> to start fresh
						</Text>
					</Box>
				</Box>
				<CommandInput onCommand={handleSlashCommand} />
			</Box>
		);
	}

	return (
		<Box flexDirection="column" minHeight={20}>
			<Header version={version} agent={config?.agent} projectName={prd?.project} />

			<TaskList />

			<IterationProgress />

			<AgentOutput />

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

			<CommandInput onCommand={handleSlashCommand} isRunning={agentIsStreaming} />

			<StatusBar />
		</Box>
	);
}
