import { Box, Text, useApp } from "ink";
import { useCallback, useEffect, useState } from "react";
import { useAgent } from "../hooks/useAgent.ts";
import { useIteration } from "../hooks/useIteration.ts";
import { loadConfig } from "../lib/config.ts";
import { findPrdFile, loadPrd, PROGRESS_FILE_PATH, RALPH_DIR } from "../lib/prd.ts";
import type { Prd, RalphConfig } from "../types.ts";
import { AgentOutput } from "./AgentOutput.tsx";
import { Message } from "./common/Message.tsx";
import { Header } from "./Header.tsx";
import { IterationProgress } from "./IterationProgress.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { TaskList } from "./TaskList.tsx";
import { existsSync } from "node:fs";

interface RunAppProps {
	version: string;
	iterations: number;
}

type AppState = "validating" | "running" | "complete" | "error" | "max_iterations";

interface ValidationError {
	message: string;
	hint: string;
}

function validateProject(): ValidationError | null {
	const prdFile = findPrdFile();
	if (!prdFile) {
		return {
			message: `No prd.json or prd.yaml found in ${RALPH_DIR}/`,
			hint: "Run 'ralph init' to create one",
		};
	}

	if (!existsSync(PROGRESS_FILE_PATH)) {
		return {
			message: `No ${PROGRESS_FILE_PATH} found`,
			hint: "Run 'ralph init' to create one",
		};
	}

	return null;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

export function RunApp({ version, iterations }: RunAppProps): React.ReactElement {
	const { exit } = useApp();
	const [appState, setAppState] = useState<AppState>("validating");
	const [validationError, setValidationError] = useState<ValidationError | null>(null);
	const [config, setConfig] = useState<RalphConfig | null>(null);
	const [prd, setPrd] = useState<Prd | null>(null);
	const [elapsedTime, setElapsedTime] = useState(0);

	const agent = useAgent();

	const iteration = useIteration({
		total: iterations,
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

	useEffect(() => {
		const error = validateProject();
		if (error) {
			setValidationError(error);
			setAppState("error");
			return;
		}

		const loadedConfig = loadConfig();
		const loadedPrd = loadPrd();

		setConfig(loadedConfig);
		setPrd(loadedPrd);
		setAppState("running");
		iteration.start();
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
		if (iteration.current >= iterations && !agent.isStreaming && appState === "running") {
			if (!agent.isComplete) {
				setAppState("max_iterations");
			}
		}
	}, [iteration.current, iterations, agent.isStreaming, agent.isComplete, appState]);

	useEffect(() => {
		if (appState !== "running") return;

		const timer = setInterval(() => {
			setElapsedTime((prev) => prev + 1);
		}, 1000);

		return () => clearInterval(timer);
	}, [appState]);

	useEffect(() => {
		if (appState === "complete" || appState === "max_iterations" || appState === "error") {
			const timeout = setTimeout(() => {
				exit();
			}, 100);
			return () => clearTimeout(timeout);
		}
	}, [appState, exit]);

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

	if (appState === "error" && validationError) {
		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} />
				<Box flexDirection="column" marginY={1} paddingX={1}>
					<Message type="error">{validationError.message}</Message>
					<Text dimColor>{validationError.hint}</Text>
				</Box>
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

			{appState === "complete" && (
				<Box paddingX={1} marginY={1}>
					<Message type="success">All tasks completed!</Message>
				</Box>
			)}

			{appState === "max_iterations" && (
				<Box paddingX={1} marginY={1}>
					<Message type="warning">
						Completed {iterations} iterations. PRD is not completed.
					</Message>
				</Box>
			)}

			<StatusBar
				status={getStatus()}
				elapsedTime={elapsedTime}
				currentTask={currentTask}
			/>
		</Box>
	);
}
