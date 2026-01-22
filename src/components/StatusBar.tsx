import { Box, Text } from "ink";
import { useAgentStore, useAppStore, useIterationStore } from "@/stores/index.ts";
import type { Prd } from "@/types.ts";
import { useResponsive } from "./common/ResponsiveLayout.tsx";

type AgentStatus = "idle" | "running" | "complete" | "error";

type StatusBarVariant = "full" | "compact" | "minimal";

const STATUS_INDICATORS: Record<AgentStatus, { color: string; label: string; shortLabel: string }> =
	{
		idle: { color: "gray", label: "Idle", shortLabel: "Idle" },
		running: { color: "yellow", label: "Running", shortLabel: "Run" },
		complete: { color: "green", label: "Complete", shortLabel: "Done" },
		error: { color: "red", label: "Error", shortLabel: "Err" },
	};

function formatElapsedTime(seconds: number): string {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`;
	}

	return `${remainingSeconds}s`;
}

function formatRemainingTime(milliseconds: number): string {
	const totalSeconds = Math.ceil(milliseconds / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}

	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}

	return `${seconds}s`;
}

function getCurrentTaskIndex(prd: Prd): number {
	return prd.tasks.findIndex((task) => !task.done);
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength - 1)}…`;
}

interface StatusBarProps {
	variant?: StatusBarVariant;
}

export function StatusBar({ variant: explicitVariant }: StatusBarProps = {}): React.ReactElement {
	const { isNarrow, isMedium, contentWidth } = useResponsive();

	const appState = useAppStore((state) => state.appState);
	const elapsedTime = useAppStore((state) => state.elapsedTime);
	const prd = useAppStore((state) => state.prd);
	const agentIsStreaming = useAgentStore((state) => state.isStreaming);
	const iterationIsDelaying = useIterationStore((state) => state.isDelaying);
	const getTimeRemaining = useIterationStore((state) => state.getTimeRemaining);
	const maxRuntimeMs = useIterationStore((state) => state.maxRuntimeMs);

	const getStatus = (): AgentStatus => {
		if (appState === "error") {
			return "error";
		}

		if (appState === "complete" || appState === "max_runtime") {
			return "complete";
		}

		if (agentIsStreaming) {
			return "running";
		}

		if (iterationIsDelaying) {
			return "idle";
		}

		return "idle";
	};

	const currentTaskIndex = prd ? getCurrentTaskIndex(prd) : undefined;
	const currentTask =
		prd && currentTaskIndex !== undefined && currentTaskIndex >= 0
			? prd.tasks[currentTaskIndex]?.title
			: undefined;

	const status = getStatus();
	const indicator = STATUS_INDICATORS[status];

	const timeRemaining = getTimeRemaining();
	const showTimeRemaining = maxRuntimeMs && timeRemaining !== null && appState === "running";

	const variant = explicitVariant ?? (isNarrow ? "minimal" : isMedium ? "compact" : "full");

	if (variant === "minimal") {
		const maxTaskLength = Math.max(10, contentWidth - 30);
		const truncatedTask = currentTask ? truncateText(currentTask, maxTaskLength) : undefined;

		return (
			<Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
				<Box justifyContent="space-between">
					<Text color={indicator.color}>{indicator.shortLabel}</Text>
					{elapsedTime !== undefined && <Text dimColor>{formatElapsedTime(elapsedTime)}</Text>}
				</Box>
				{truncatedTask && (
					<Text dimColor wrap="truncate-end">
						{truncatedTask}
					</Text>
				)}
			</Box>
		);
	}

	if (variant === "compact") {
		const maxTaskLength = Math.max(15, contentWidth - 50);
		const truncatedTask = currentTask ? truncateText(currentTask, maxTaskLength) : undefined;

		return (
			<Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
				<Box justifyContent="space-between" gap={1}>
					<Box gap={1}>
						<Text color={indicator.color}>{indicator.label}</Text>
						{truncatedTask && <Text dimColor>{truncatedTask}</Text>}
					</Box>
					<Box gap={1}>
						{showTimeRemaining && (
							<Text color={timeRemaining < 60_000 ? "yellow" : "gray"}>
								{formatRemainingTime(timeRemaining)}
							</Text>
						)}
						{elapsedTime !== undefined && <Text dimColor>{formatElapsedTime(elapsedTime)}</Text>}
					</Box>
				</Box>
			</Box>
		);
	}

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
				{showTimeRemaining && (
					<Text>
						<Text dimColor>remaining:</Text>{" "}
						<Text color={timeRemaining < 60_000 ? "yellow" : "gray"}>
							{formatRemainingTime(timeRemaining)}
						</Text>
					</Text>
				)}
				{elapsedTime !== undefined && <Text dimColor>{formatElapsedTime(elapsedTime)}</Text>}
				<Text dimColor>ctrl+c to exit</Text>
			</Box>
		</Box>
	);
}
