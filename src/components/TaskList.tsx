import { Box, Text } from "ink";
import type { PrdTask } from "../types.ts";

interface TaskListProps {
	tasks: PrdTask[];
	currentTaskIndex?: number;
	collapsed?: boolean;
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

	const currentTask = currentTaskIndex !== undefined && currentTaskIndex >= 0
		? tasks[currentTaskIndex]
		: null;

	const allTasksComplete = completedCount === totalCount;

	return (
		<Box flexDirection="column" paddingX={1}>
			<Box marginBottom={1}>
				<Text bold>
					Tasks ({completedCount}/{totalCount})
				</Text>
			</Box>
			{currentTask ? (
				<Box>
					<Text color="yellow">▶ </Text>
					<Text dimColor>{currentTaskIndex! + 1}. </Text>
					<Text color="white">{currentTask.title}</Text>
				</Box>
			) : allTasksComplete ? (
				<Box>
					<Text color="green">✔ </Text>
					<Text color="gray">All tasks completed</Text>
				</Box>
			) : (
				<Box>
					<Text dimColor>No current task</Text>
				</Box>
			)}
		</Box>
	);
}
