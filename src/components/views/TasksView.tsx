import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { STATUS_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";
import { deleteTask, savePrd, toggleTaskDone } from "@/lib/prd.ts";
import { getPrdService, type Prd } from "@/lib/services/index.ts";

type ViewMode = "list" | "confirm-delete";

interface TasksViewProps {
	version: string;
	onClose: () => void;
}

function TasksHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Tasks
			</Text>
		</Box>
	);
}

function TasksFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>↑/↓ Navigate | d Toggle done | x Delete | q/Esc Close</Text>
		</Box>
	);
}

export function TasksView({ version, onClose }: TasksViewProps): React.ReactElement {
	const prdService = getPrdService();
	const [prd, setPrd] = useState<Prd | null>(() => prdService.get());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("list");

	const tasks = prd?.tasks ?? [];

	useEffect(() => {
		if (statusMessage) {
			const timeout = setTimeout(() => setStatusMessage(null), STATUS_MESSAGE_TIMEOUT_MS);

			return () => clearTimeout(timeout);
		}
	}, [statusMessage]);

	useInput((input, key) => {
		if (viewMode === "confirm-delete") {
			if (key.escape) {
				setViewMode("list");

				return;
			}

			if (key.return && prd && tasks.length > 0) {
				const selectedTask = tasks.at(selectedIndex);

				if (!selectedTask) {
					return;
				}

				const updatedPrd = deleteTask(prd, selectedIndex);

				savePrd(updatedPrd);
				setPrd(updatedPrd);
				setViewMode("list");

				const newSelectedIndex = Math.min(selectedIndex, updatedPrd.tasks.length - 1);

				setSelectedIndex(Math.max(0, newSelectedIndex));
				setStatusMessage(`Deleted: ${selectedTask.title}`);
			}

			return;
		}

		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);

			return;
		}

		if (key.downArrow && selectedIndex < tasks.length - 1) {
			setSelectedIndex(selectedIndex + 1);

			return;
		}

		if (input === "d" && prd && tasks.length > 0) {
			const selectedTask = tasks.at(selectedIndex);

			if (!selectedTask) {
				return;
			}

			const updatedPrd = toggleTaskDone(prd, selectedIndex);

			savePrd(updatedPrd);
			setPrd(updatedPrd);

			const newStatus = !selectedTask.done;
			const statusText = newStatus ? "completed" : "incomplete";

			setStatusMessage(`Task marked as ${statusText}`);
		}

		if (input === "x" && tasks.length > 0) {
			setViewMode("confirm-delete");
		}
	});

	const selectedTask = tasks.at(selectedIndex);
	const completedCount = tasks.filter((task) => task.done).length;

	return (
		<ResponsiveLayout
			header={<TasksHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
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
												<Text color={isSelected ? "cyan" : undefined}>
													{isSelected ? "❯ " : "  "}
												</Text>
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

						{viewMode === "confirm-delete" && selectedTask && (
							<Box
								flexDirection="column"
								marginTop={1}
								borderStyle="single"
								borderColor="red"
								paddingX={1}
							>
								<Text bold color="red">
									Delete task?
								</Text>
								<Box marginTop={1}>
									<Text>"{selectedTask.title}"</Text>
								</Box>
								<Box marginTop={1}>
									<Text dimColor>Press Enter to confirm, Escape to cancel</Text>
								</Box>
							</Box>
						)}

						{statusMessage && (
							<Box marginTop={1}>
								<Text color="green">{statusMessage}</Text>
							</Box>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<TasksFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
