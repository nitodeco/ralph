import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { getPrdService, type Prd } from "@/lib/services/index.ts";

interface TasksViewProps {
	version: string;
	onClose: () => void;
}

export function TasksView({ version, onClose }: TasksViewProps): React.ReactElement {
	const prdService = getPrdService();
	const [prd] = useState<Prd | null>(() => prdService.get());
	const [selectedIndex, setSelectedIndex] = useState(0);

	const tasks = prd?.tasks ?? [];

	useInput((input, key) => {
		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		}

		if (key.downArrow && selectedIndex < tasks.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		}
	});

	const selectedTask = tasks.at(selectedIndex);
	const completedCount = tasks.filter((task) => task.done).length;

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Tasks
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
				<Box flexDirection="column">
					<Text bold color="yellow">
						Tasks ({completedCount}/{tasks.length} completed):
					</Text>
					<Box flexDirection="column" marginTop={1}>
						{tasks.length === 0 ? (
							<Text dimColor>No tasks found. Run /init to create a project.</Text>
						) : (
							tasks.map((task, index) => {
								const isSelected = index === selectedIndex;
								const statusIcon = task.done ? "✓" : "○";
								const statusColor = task.done ? "green" : "gray";
								const stepCount = task.steps.length;

								return (
									<Box key={task.title}>
										<Text color={isSelected ? "cyan" : undefined}>{isSelected ? "❯ " : "  "}</Text>
										<Text color={statusColor}>{statusIcon} </Text>
										<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
											{task.title}
										</Text>
										<Text dimColor> ({stepCount} steps)</Text>
									</Box>
								);
							})
						)}
					</Box>
				</Box>

				{selectedTask && (
					<Box
						flexDirection="column"
						marginTop={1}
						borderStyle="single"
						borderColor="gray"
						paddingX={1}
					>
						<Text bold color="yellow">
							{selectedTask.title}
						</Text>
						<Box marginTop={1}>
							<Text>{selectedTask.description}</Text>
						</Box>
						{selectedTask.steps.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								<Text bold dimColor>
									Steps:
								</Text>
								{selectedTask.steps.map((step) => (
									<Box key={step} paddingLeft={1}>
										<Text dimColor>{step}</Text>
									</Box>
								))}
							</Box>
						)}
					</Box>
				)}

				<Box flexDirection="column" marginTop={1}>
					<Text dimColor>↑/↓ Navigate | q/Esc Close</Text>
				</Box>
			</Box>
		</Box>
	);
}
