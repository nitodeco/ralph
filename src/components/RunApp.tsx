import { Box, Text, useApp } from "ink";
import { useCallback, useEffect, useState } from "react";
import { useAgent } from "../hooks/useAgent.ts";
import { useIteration } from "../hooks/useIteration.ts";
import { loadConfig } from "../lib/config.ts";
import { findPrdFile, loadPrd, PROGRESS_FILE_PATH, RALPH_DIR } from "../lib/prd.ts";
import type { Prd, RalphConfig } from "../types.ts";
import { AddTaskWizard } from "./AddTaskWizard.tsx";
import { AgentOutput } from "./AgentOutput.tsx";
import { CommandInput, type CommandArgs, type SlashCommand } from "./CommandInput.tsx";
import { Message } from "./common/Message.tsx";
import { Header } from "./Header.tsx";
import { HelpView } from "./HelpView.tsx";
import { InitWizard } from "./InitWizard.tsx";
import { IterationProgress } from "./IterationProgress.tsx";
import { SetupWizard } from "./SetupWizard.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { TaskList } from "./TaskList.tsx";
import { UpdatePrompt } from "./UpdatePrompt.tsx";
import { existsSync } from "node:fs";

interface RunAppProps {
	version: string;
	iterations: number;
}

type AppState = "idle" | "running" | "complete" | "error" | "max_iterations" | "not_initialized";
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

export function RunApp({ version, iterations }: RunAppProps): React.ReactElement {
	const { exit } = useApp();
	const [appState, setAppState] = useState<AppState>("idle");
	const [activeView, setActiveView] = useState<ActiveView>("run");
	const [validationWarning, setValidationWarning] = useState<ValidationWarning | null>(null);
	const [config, setConfig] = useState<RalphConfig | null>(null);
	const [prd, setPrd] = useState<Prd | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);

	const agent = useAgent();

	const iteration = useIteration({
		total: iterations || DEFAULT_ITERATIONS,
		onIterationStart: () => {
			agent.reset();
			const currentPrd = loadPrd();
			if (currentPrd) {
				setPrd(currentPrd);
			}
		},
		onAllComplete: () => {
			setAppState("complete");
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

	const startIterations = useCallback((iterationCount?: number) => {
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

		if (iterationCount) {
			iteration.setTotal(iterationCount);
		}

		setAppState("running");
		setElapsedTime(0);
		agent.reset();
		iteration.start();
	}, [agent, iteration]);

	const handleSlashCommand = useCallback((command: SlashCommand, args?: CommandArgs) => {
		switch (command) {
			case "start":
				startIterations(args?.iterations);
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
	}, [agent, iteration, exit, startIterations]);

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
		setAppState("idle");
	}, []);

	useEffect(() => {
		if (iteration.isRunning && iteration.current > 0 && !agent.isStreaming && !iteration.isDelaying) {
			agent.start();
		}
	}, [iteration.isRunning, iteration.current, iteration.isDelaying]);

	useEffect(() => {
		if (!agent.isStreaming && agent.exitCode !== null) {
			handleAgentComplete();
		}
	}, [agent.isStreaming, agent.exitCode, handleAgentComplete]);

	useEffect(() => {
		if (iteration.current >= iteration.total && !agent.isStreaming && appState === "running") {
			if (!agent.isComplete) {
				setAppState("max_iterations");
			}
		}
	}, [iteration.current, iteration.total, agent.isStreaming, agent.isComplete, appState]);

	useEffect(() => {
		if (appState !== "running" || activeView !== "run") return;

		const timer = setInterval(() => {
			setElapsedTime((prev) => prev + 1);
		}, 1000);

		return () => clearInterval(timer);
	}, [appState, activeView]);

	useEffect(() => {
		if ((appState === "complete" || appState === "max_iterations" || appState === "error") && activeView === "run") {
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
	const currentTask = prd && currentTaskIndex !== undefined && currentTaskIndex >= 0
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

	return (
		<Box flexDirection="column" minHeight={20}>
			<Header
				version={version}
				agent={config?.agent}
				projectName={prd?.project}
			/>

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
			/>

			{appState === "idle" && (
				<Box paddingX={1} marginY={1}>
					<Text dimColor>
						Type <Text color="cyan">/start</Text> or <Text color="cyan">/start [n]</Text> to begin iterations
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

			<CommandInput onCommand={handleSlashCommand} disabled={agent.isStreaming} />

			<StatusBar
				status={getStatus()}
				elapsedTime={elapsedTime}
				currentTask={currentTask}
			/>
		</Box>
	);
}
