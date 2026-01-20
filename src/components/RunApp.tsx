import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useState } from "react";
import { validateConfig } from "@/lib/config.ts";
import { getNextTask, loadPrd } from "@/lib/prd.ts";
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
import { Spinner } from "./common/Spinner.tsx";
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
	dryRun?: boolean;
	initialTask?: string;
}

export function RunApp({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
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
	const setManualNextTask = useAppStore((state) => state.setManualNextTask);

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

	const [nextTaskMessage, setNextTaskMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const [dryRunState, setDryRunState] = useState<{
		status: "idle" | "validating" | "simulating" | "complete";
		currentIteration: number;
		logs: string[];
		errors: string[];
		warnings: string[];
	}>({
		status: "idle",
		currentIteration: 0,
		logs: [],
		errors: [],
		warnings: [],
	});

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
						setNextTaskMessage({
							type: "error",
							text: "Usage: /next <task number or title>",
						});
						setTimeout(() => setNextTaskMessage(null), 5000);
					}
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
		setupIterationCallbacks(iterations);
		loadInitialState(autoResume);
	}, [autoResume, iterations, loadInitialState, setIterations]);

	useEffect(() => {
		if (autoResume && pendingSession && appState === "idle") {
			resumeSession();
		}
	}, [autoResume, pendingSession, appState, resumeSession]);

	useEffect(() => {
		if (dryRun) {
			return;
		}
		if (initialTask && appState === "idle" && !pendingSession) {
			const result = setManualNextTask(initialTask);
			if (result.success) {
				setNextTaskMessage({
					type: "success",
					text: `Task set: ${result.taskTitle}`,
				});
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
		if (!dryRun || dryRunState.status !== "idle") {
			return;
		}

		const runDryRunSimulation = async () => {
			const logs: string[] = [];
			const errors: string[] = [];
			const warnings: string[] = [];

			setDryRunState((prev) => ({
				...prev,
				status: "validating",
				logs: ["Validating configuration..."],
			}));

			await new Promise((resolve) => setTimeout(resolve, 500));

			if (config) {
				const validation = validateConfig(config);
				if (!validation.valid) {
					for (const error of validation.errors) {
						errors.push(`Config error: ${error.field} - ${error.message}`);
					}
				}
				for (const warning of validation.warnings) {
					warnings.push(`Config warning: ${warning.field} - ${warning.message}`);
				}
				logs.push(`Configuration validated (agent: ${config.agent})`);
			} else {
				errors.push("No configuration found. Run 'ralph setup' first.");
			}

			await new Promise((resolve) => setTimeout(resolve, 300));

			const currentPrd = loadPrd();
			if (currentPrd) {
				logs.push(`PRD loaded: "${currentPrd.project}"`);
				logs.push(`Total tasks: ${currentPrd.tasks.length}`);
				const completedCount = currentPrd.tasks.filter((task) => task.done).length;
				const pendingCount = currentPrd.tasks.length - completedCount;
				logs.push(`Completed: ${completedCount}, Pending: ${pendingCount}`);
			} else {
				errors.push("No PRD found. Run 'ralph init' first.");
			}

			setDryRunState((prev) => ({
				...prev,
				logs: [...logs],
				errors: [...errors],
				warnings: [...warnings],
			}));

			if (errors.length > 0) {
				setDryRunState((prev) => ({ ...prev, status: "complete" }));
				return;
			}

			setDryRunState((prev) => ({ ...prev, status: "simulating" }));

			const prdForSimulation = currentPrd;
			if (!prdForSimulation) {
				setDryRunState((prev) => ({ ...prev, status: "complete" }));
				return;
			}

			const simulationIterations = Math.min(
				iterations,
				prdForSimulation.tasks.filter((task) => !task.done).length,
			);
			logs.push(`\nSimulating ${simulationIterations} iteration(s)...`);
			logs.push("─".repeat(50));

			for (let iterationIndex = 1; iterationIndex <= simulationIterations; iterationIndex++) {
				setDryRunState((prev) => ({
					...prev,
					currentIteration: iterationIndex,
					logs: [...prev.logs, `\n[Iteration ${iterationIndex}/${simulationIterations}]`],
				}));

				await new Promise((resolve) => setTimeout(resolve, 800));

				const nextTask = getNextTask(prdForSimulation);
				if (nextTask) {
					setDryRunState((prev) => ({
						...prev,
						logs: [...prev.logs, `  → Would work on: "${nextTask.title}"`],
					}));

					await new Promise((resolve) => setTimeout(resolve, 500));

					setDryRunState((prev) => ({
						...prev,
						logs: [
							...prev.logs,
							`  → Agent (${config?.agent ?? "cursor"}) would execute with prompt`,
							`  → Steps: ${nextTask.steps.length} defined`,
						],
					}));

					await new Promise((resolve) => setTimeout(resolve, 500));

					setDryRunState((prev) => ({
						...prev,
						logs: [...prev.logs, `  ✓ Simulated completion`],
					}));

					nextTask.done = true;
				} else {
					setDryRunState((prev) => ({
						...prev,
						logs: [...prev.logs, `  → No pending tasks remaining`],
					}));
					break;
				}
			}

			setDryRunState((prev) => ({
				...prev,
				status: "complete",
				logs: [
					...prev.logs,
					"\n─".repeat(50),
					"Dry-run simulation complete.",
					"No changes were made to your project.",
				],
			}));
		};

		runDryRunSimulation();
	}, [dryRun, dryRunState.status, config, iterations]);

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

	if (dryRun) {
		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} agent={config?.agent} projectName={prd?.project} />
				<Box flexDirection="column" marginY={1} paddingX={1}>
					<Box marginBottom={1}>
						<Text color="cyan" bold>
							◆ Dry-Run Mode
						</Text>
						{dryRunState.status !== "complete" && (
							<Box marginLeft={1}>
								<Spinner />
							</Box>
						)}
					</Box>

					{dryRunState.logs.map((log, logIndex) => (
						<Text key={`log-${logIndex}-${log.slice(0, 20)}`} dimColor={log.startsWith("  ")}>
							{log}
						</Text>
					))}

					{dryRunState.errors.length > 0 && (
						<Box flexDirection="column" marginTop={1}>
							{dryRunState.errors.map((error, errorIndex) => (
								<Text key={`error-${errorIndex}-${error.slice(0, 20)}`} color="red">
									✗ {error}
								</Text>
							))}
						</Box>
					)}

					{dryRunState.warnings.length > 0 && (
						<Box flexDirection="column" marginTop={1}>
							{dryRunState.warnings.map((warning, warningIndex) => (
								<Text key={`warning-${warningIndex}-${warning.slice(0, 20)}`} color="yellow">
									! {warning}
								</Text>
							))}
						</Box>
					)}

					{dryRunState.status === "complete" && (
						<Box marginTop={1}>
							<Text dimColor>Press Ctrl+C to exit</Text>
						</Box>
					)}
				</Box>
			</Box>
		);
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

			<CommandInput onCommand={handleSlashCommand} isRunning={agentIsStreaming} />

			<StatusBar />
		</Box>
	);
}
