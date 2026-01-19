import { Box, Text } from "ink";

type AgentStatus = "idle" | "running" | "complete" | "error";

interface StatusBarProps {
	status: AgentStatus;
	elapsedTime?: number;
	currentTask?: string;
}

const STATUS_INDICATORS: Record<AgentStatus, { color: string; label: string }> =
	{
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

export function StatusBar({
	status,
	elapsedTime,
	currentTask,
}: StatusBarProps): React.ReactElement {
	const indicator = STATUS_INDICATORS[status];

	return (
		<Box
			borderStyle="single"
			borderColor="gray"
			paddingX={1}
			justifyContent="space-between"
		>
			<Box gap={2}>
				<Text>
					<Text dimColor>status:</Text>{" "}
					<Text color={indicator.color}>{indicator.label}</Text>
				</Text>
				{currentTask && (
					<Text>
						<Text dimColor>task:</Text> <Text>{currentTask}</Text>
					</Text>
				)}
			</Box>
			<Box gap={2}>
				{elapsedTime !== undefined && (
					<Text dimColor>{formatElapsedTime(elapsedTime)}</Text>
				)}
				<Text dimColor>ctrl+c to exit</Text>
			</Box>
		</Box>
	);
}
