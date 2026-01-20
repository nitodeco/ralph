import { existsSync } from "node:fs";
import { Box, Text, useApp, useInput } from "ink";
import { useCallback, useEffect, useState } from "react";
import { useAgent } from "../hooks/useAgent.ts";
import { useIteration } from "../hooks/useIteration.ts";
import { loadConfig } from "../lib/config.ts";
import { getLogger } from "../lib/logger.ts";
import { sendNotifications } from "../lib/notifications.ts";
import { findPrdFile, loadPrd, PROGRESS_FILE_PATH, RALPH_DIR } from "../lib/prd.ts";
import {
	createSession,
	deleteSession,
	isSessionResumable,
	loadSession,
	saveSession,
	updateSessionIteration,
	updateSessionStatus,
} from "../lib/session.ts";
import type { Prd, RalphConfig, Session } from "../types.ts";
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
}

type AppState =
	| "idle"
	| "running"
	| "complete"
	| "error"
	| "max_iterations"
	| "not_initialized"
	| "resume_prompt";
type ActiveView = "run" | "init" | "setup" | "update" | "help" | "add";

interface ValidationWarning {
	message: string;
	hint: string;
}

function validateProject(): ValidationWarning | null {
	const prdFile = findPrdFile();
	if (!prdFile) {
		return {
			message: `No prd.json or prd.yaml found in ${RALPH_DIR}/`,
			hint: "Run 'ralph init' or type /init to create one",
		};
	}

	if (!existsSync(PROGRESS_FILE_PATH)) {
		return {
			message: `No ${PROGRESS_FILE_PATH} found`,
			hint: "Run 'ralph init' or type /init to create one",
		};
	}

	return null;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

const DEFAULT_ITERATIONS = 10;

export function RunApp({
	version,
	iterations,
	autoResume = false,
}: RunAppProps): React.ReactElement {
	const { exit } = useApp();
	const [appState, setAppState] = useState<AppState>("idle");
	const [activeView, setActiveView] = useState<ActiveView>("run");
	const [validationWarning, setValidationWarning] = useState<ValidationWarning | null>(null);
	const [config, setConfig] = useState<RalphConfig | null>(null);
	const [prd, setPrd] = useState<Prd | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [pendingSession, setPendingSession] = useState<Session | null>(null);
	const [currentSession, setCurrentSession] = useState<Session | null>(null);

	const agent = useAgent();

	const iteration = useIteration({
		total: iterations || DEFAULT_ITERATIONS,
		onIterationStart: (iterationNumber) => {
			const currentConfig = loadConfig();
			const logger = getLogger({ logFilePath: currentConfig.logFilePath });
			logger.logIterationStart(iterationNumber, iterations || DEFAULT_ITERATIONS);
			agent.reset();
			const currentPrd = loadPrd();
			if (currentPrd) {
				setPrd(currentPrd);
			}
		},
		onIterationComplete: (iterationNumber) => {
			const currentConfig = loadConfig();
			const logger = getLogger({ logFilePath: currentConfig.logFilePath });
			logger.logIterationComplete(
				iterationNumber,
				iterations || DEFAULT_ITERATIONS,
				agent.isComplete,
			);
			if (currentSession) {
				const currentPrd = loadPrd();
				const taskIndex = currentPrd ? getCurrentTaskIndex(currentPrd) : 0;
				const updatedSession = updateSessionIteration(
					currentSession,
					iterationNumber,
					taskIndex,
					elapsedTime,
				);
				saveSession(updatedSession);
				setCurrentSession(updatedSession);
			}
		},
		onAllComplete: () => {
			const currentConfig = loadConfig();
			const logger = getLogger({ logFilePath: currentConfig.logFilePath });
			logger.logSessionComplete();
			const currentPrd = loadPrd();
			sendNotifications(currentConfig.notifications, "complete", currentPrd?.project, {
				totalIterations: iterations || DEFAULT_ITERATIONS,
			});
			setAppState("complete");
			if (currentSession) {
				deleteSession();
				setCurrentSession(null);
			}
		},
	});

	const handleAgentComplete = useCallback(() => {
		if (agent.isComplete) {
			setAppState("complete");
			iteration.stop();
		} else {
			iteration.markIterationComplete(agent.isComplete);
		}
	}, [agent.isComplete, iteration]);

	const revalidateAndGoIdle = useCallback(() => {
		const warning = validateProject();
		if (warning) {
			setValidationWarning(warning);
			setAppState("not_initialized");
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		setConfig(loadedConfig);
		setPrd(loadedPrd);
		setValidationWarning(null);
		setAppState("idle");
		setElapsedTime(0);
		agent.reset();
	}, [agent]);

	const startIterations = useCallback(
		(iterationCount?: number, full?: boolean) => {
			const warning = validateProject();
			if (warning) {
				setValidationWarning(warning);
				setAppState("not_initialized");
				return;
			}

			const loadedConfig = loadConfig();
			const loadedPrd = loadPrd();
			const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

			setConfig(loadedConfig);
			setPrd(loadedPrd);
			setValidationWarning(null);

			deleteSession();
			setPendingSession(null);

			let totalIters = iterationCount || iterations || DEFAULT_ITERATIONS;
			if (full && loadedPrd) {
				const incompleteTasks = loadedPrd.tasks.filter((task) => !task.done).length;
				totalIters = incompleteTasks > 0 ? incompleteTasks : 1;
			}
			iteration.setTotal(totalIters);

			const taskIndex = loadedPrd ? getCurrentTaskIndex(loadedPrd) : 0;
			const newSession = createSession(totalIters, taskIndex);
			saveSession(newSession);
			setCurrentSession(newSession);

			logger.logSessionStart(totalIters, taskIndex);

			setAppState("running");
			setElapsedTime(0);
			agent.reset();
			iteration.start();
		},
		[agent, iteration, iterations],
	);

	const resumeSession = useCallback(() => {
		if (!pendingSession) {
			return;
		}

		const warning = validateProject();
		if (warning) {
			setValidationWarning(warning);
			setAppState("not_initialized");
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

		setConfig(loadedConfig);
		setPrd(loadedPrd);
		setValidationWarning(null);

		const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;
		iteration.setTotal(remainingIterations > 0 ? remainingIterations : 1);

		const resumedSession = updateSessionStatus(pendingSession, "running");
		saveSession(resumedSession);
		setCurrentSession(resumedSession);
		setPendingSession(null);

		logger.logSessionResume(
			pendingSession.currentIteration,
			pendingSession.totalIterations,
			pendingSession.elapsedTimeSeconds,
		);

		setAppState("running");
		setElapsedTime(pendingSession.elapsedTimeSeconds);
		agent.reset();
		iteration.start();
	}, [agent, iteration, pendingSession]);

	const stopAgent = useCallback(() => {
		if (agent.isStreaming) {
			agent.stop();
			iteration.stop();
			setAppState("idle");
		}
	}, [agent, iteration]);

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
					agent.stop();
					iteration.pause();
					setActiveView("init");
					break;
				case "setup":
					agent.stop();
					iteration.pause();
					setActiveView("setup");
					break;
				case "update":
					agent.stop();
					iteration.pause();
					setActiveView("update");
					break;
				case "help":
					agent.stop();
					iteration.pause();
					setActiveView("help");
					break;
				case "add":
					agent.stop();
					iteration.pause();
					setActiveView("add");
					break;
				case "quit":
				case "exit":
					exit();
					break;
			}
		},
		[agent, iteration, exit, startIterations, resumeSession, stopAgent],
	);

	const handleViewComplete = useCallback(() => {
		setActiveView("run");
		revalidateAndGoIdle();
	}, [revalidateAndGoIdle]);

	const handleHelpClose = useCallback(() => {
		setActiveView("run");
		if (appState === "running" && iteration.isPaused) {
			iteration.resume();
		}
	}, [appState, iteration]);

	useInput(
		(_input, key) => {
			if (key.escape && agent.isStreaming && activeView === "run") {
				stopAgent();
			}
		},
		{ isActive: activeView === "run" },
	);

	useEffect(() => {
		const warning = validateProject();
		if (warning) {
			setValidationWarning(warning);
			setAppState("not_initialized");
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		setConfig(loadedConfig);
		setPrd(loadedPrd);

		const existingSession = loadSession();
		if (isSessionResumable(existingSession)) {
			setPendingSession(existingSession);
			if (autoResume) {
				setAppState("idle");
			} else {
				setAppState("resume_prompt");
			}
		} else {
			setAppState("idle");
		}
	}, [autoResume]);

	useEffect(() => {
		if (autoResume && pendingSession && appState === "idle") {
			resumeSession();
		}
	}, [autoResume, pendingSession, appState, resumeSession]);

	useEffect(() => {
		if (
			iteration.isRunning &&
			iteration.current > 0 &&
			!agent.isStreaming &&
			!iteration.isDelaying
		) {
			agent.start();
		}
	}, [
		iteration.isRunning,
		iteration.current,
		iteration.isDelaying,
		agent.isStreaming,
		agent.start,
	]);

	useEffect(() => {
		if (!agent.isStreaming && agent.exitCode !== null) {
			handleAgentComplete();
		}
	}, [agent.isStreaming, agent.exitCode, handleAgentComplete]);

	useEffect(() => {
		if (iteration.current >= iteration.total && !agent.isStreaming && appState === "running") {
			if (!agent.isComplete) {
				const currentConfig = loadConfig();
				const logger = getLogger({ logFilePath: currentConfig.logFilePath });
				logger.logMaxIterationsReached(iteration.total);
				sendNotifications(currentConfig.notifications, "max_iterations", prd?.project, {
					completedIterations: iteration.current,
					totalIterations: iteration.total,
				});
				setAppState("max_iterations");
			}
		}
	}, [
		iteration.current,
		iteration.total,
		agent.isStreaming,
		agent.isComplete,
		appState,
		prd?.project,
	]);

	useEffect(() => {
		if (appState !== "running" || activeView !== "run") return;

		const timer = setInterval(() => {
			setElapsedTime((prev) => prev + 1);
		}, 1000);

		return () => clearInterval(timer);
	}, [appState, activeView]);

	useEffect(() => {
		if (agent.error?.startsWith("Fatal error:") && appState === "running") {
			const currentConfig = loadConfig();
			const logger = getLogger({ logFilePath: currentConfig.logFilePath });
			logger.error("Fatal error occurred", { error: agent.error });
			sendNotifications(currentConfig.notifications, "fatal_error", prd?.project, {
				error: agent.error,
			});
			setAppState("error");
		}
	}, [agent.error, appState, prd?.project]);

	useEffect(() => {
		if (
			(appState === "complete" || appState === "max_iterations" || appState === "error") &&
			activeView === "run"
		) {
			const timeout = setTimeout(() => {
				exit();
			}, 100);
			return () => clearTimeout(timeout);
		}
	}, [appState, activeView, exit]);

	const getStatus = () => {
		if (appState === "error") return "error";
		if (appState === "complete") return "complete";
		if (agent.isStreaming) return "running";
		if (iteration.isDelaying) return "idle";
		return "idle";
	};

	const currentTaskIndex = prd ? getCurrentTaskIndex(prd) : undefined;
	const currentTask =
		prd && currentTaskIndex !== undefined && currentTaskIndex >= 0
			? prd.tasks[currentTaskIndex]?.title
			: undefined;

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

			{prd && (
				<TaskList
					tasks={prd.tasks}
					currentTaskIndex={currentTaskIndex}
					collapsed={agent.isStreaming}
				/>
			)}

			<IterationProgress
				current={iteration.current}
				total={iteration.total}
				isRunning={iteration.isRunning}
				isDelaying={iteration.isDelaying}
			/>

			<AgentOutput
				output={agent.output}
				isStreaming={agent.isStreaming}
				error={agent.error}
				retryCount={agent.retryCount}
				isRetrying={agent.isRetrying}
			/>

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
						Completed {iteration.total} iterations. PRD is not completed.
					</Message>
				</Box>
			)}

			<CommandInput onCommand={handleSlashCommand} isRunning={agent.isStreaming} />

			<StatusBar status={getStatus()} elapsedTime={elapsedTime} currentTask={currentTask} />
		</Box>
	);
}
