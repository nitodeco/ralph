import { Box, Text } from "ink";
import type { PrdTask } from "../types.ts";

interface TaskListProps {
	tasks: PrdTask[];
	currentTaskIndex?: number;
	collapsed?: boolean;
}

interface TaskItemProps {
	task: PrdTask;
	isCurrent: boolean;
	index: number;
}

function TaskItem({ task, isCurrent, index }: TaskItemProps): React.ReactElement {
	const getStatusIndicator = (): { symbol: string; color: string } => {
		if (task.done) {
			return { symbol: "✔", color: "green" };
		}
		if (isCurrent) {
			return { symbol: "▶", color: "yellow" };
		}
		return { symbol: "○", color: "gray" };
	};

	const status = getStatusIndicator();
	const textColor = task.done ? "gray" : isCurrent ? "white" : "gray";

	return (
		<Box>
			<Text color={status.color}>{status.symbol} </Text>
			<Text dimColor>{index + 1}. </Text>
			<Text color={textColor} strikethrough={task.done}>
				{task.title}
			</Text>
		</Box>
	);
}

export function TaskList({
	tasks,
	currentTaskIndex,
	collapsed = false,
}: TaskListProps): React.ReactElement {
	const completedCount = tasks.filter((task) => task.done).length;
	const totalCount = tasks.length;

	if (collapsed) {
		return (
			<Box paddingX={1}>
				<Text dimColor>
					Tasks: {completedCount}/{totalCount} completed
				</Text>
			</Box>
		);
	}

	if (tasks.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No tasks defined</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingX={1}>
			<Box marginBottom={1}>
				<Text bold>
					Tasks ({completedCount}/{totalCount})
				</Text>
			</Box>
			{tasks.map((task, index) => (
				<TaskItem
					key={task.title}
					task={task}
					isCurrent={index === currentTaskIndex}
					index={index}
				/>
			))}
		</Box>
	);
}
