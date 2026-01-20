import { Box, Text } from "ink";
import { useAgentStore, useAppStore, useIterationStore } from "../stores/index.ts";
import type { Prd } from "../types.ts";

type AgentStatus = "idle" | "running" | "complete" | "error";

const STATUS_INDICATORS: Record<AgentStatus, { color: string; label: string }> = {
	idle: { color: "gray", label: "Idle" },
	running: { color: "yellow", label: "Running" },
	complete: { color: "green", label: "Complete" },
	error: { color: "red", label: "Error" },
};

function formatElapsedTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`;
	}
	return `${remainingSeconds}s`;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

export function StatusBar(): React.ReactElement {
	const appState = useAppStore((state) => state.appState);
	const elapsedTime = useAppStore((state) => state.elapsedTime);
	const prd = useAppStore((state) => state.prd);
	const agentIsStreaming = useAgentStore((state) => state.isStreaming);
	const iterationIsDelaying = useIterationStore((state) => state.isDelaying);

	const getStatus = (): AgentStatus => {
		if (appState === "error") return "error";
		if (appState === "complete") return "complete";
		if (agentIsStreaming) return "running";
		if (iterationIsDelaying) return "idle";
		return "idle";
	};

	const currentTaskIndex = prd ? getCurrentTaskIndex(prd) : undefined;
	const currentTask =
		prd && currentTaskIndex !== undefined && currentTaskIndex >= 0
			? prd.tasks[currentTaskIndex]?.title
			: undefined;

	const status = getStatus();
	const indicator = STATUS_INDICATORS[status];

	return (
		<Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
			<Box gap={2}>
				<Text>
					<Text dimColor>status:</Text> <Text color={indicator.color}>{indicator.label}</Text>
				</Text>
				{currentTask && (
					<Text>
						<Text dimColor>task:</Text> <Text>{currentTask}</Text>
					</Text>
				)}
			</Box>
			<Box gap={2}>
				{elapsedTime !== undefined && <Text dimColor>{formatElapsedTime(elapsedTime)}</Text>}
				<Text dimColor>ctrl+c to exit</Text>
			</Box>
		</Box>
	);
}
