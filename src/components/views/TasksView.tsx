import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { DetailPanel } from "@/components/common/DetailPanel.tsx";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { SelectableList } from "@/components/common/SelectableList.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { useListNavigation } from "@/hooks/useListNavigation.ts";
import { getPrdService, type Prd, type PrdTask } from "@/lib/services/index.ts";

type ViewMode = "list" | "confirm-delete" | "edit";
type EditField = "title" | "description" | "steps";

interface EditState {
	activeField: EditField;
	stepIndex: number;
	editedTask: PrdTask | null;
}

interface TasksViewProps {
	version: string;
	onClose: () => void;
}

function getInitialEditState(): EditState {
	return {
		activeField: "title",
		stepIndex: 0,
		editedTask: null,
	};
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

interface TasksFooterProps {
	viewMode: ViewMode;
}

function TasksFooter({ viewMode }: TasksFooterProps): React.ReactElement {
	if (viewMode === "edit") {
		return (
			<Box paddingX={1} gap={2}>
				<Text dimColor>Tab Next field</Text>
				<Text dimColor>Shift+Tab Previous</Text>
				<Text dimColor>Ctrl+Enter Save</Text>
				<Text dimColor>Esc Cancel</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1}>
			<Text dimColor>↑/↓ Navigate | d Toggle done | e Edit | x Delete | q/Esc Close</Text>
		</Box>
	);
}

interface TaskItemProps {
	task: PrdTask;
	isSelected: boolean;
}

function TaskItem({ task, isSelected }: TaskItemProps): React.ReactElement {
	const statusIcon = task.done ? "✓" : "○";
	const statusColor = task.done ? "green" : "gray";
	const stepCount = task.steps.length;

	return (
		<>
			<Text color={statusColor}>{statusIcon} </Text>
			<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
				{task.title}
			</Text>
			<Text dimColor> ({stepCount} steps)</Text>
		</>
	);
}

interface TaskDetailProps {
	task: PrdTask;
}

function TaskDetail({ task }: TaskDetailProps): React.ReactElement {
	return (
		<DetailPanel borderColor="gray">
			<Text bold color="yellow">
				{task.title}
			</Text>
			<Box marginTop={1}>
				<Text>{task.description}</Text>
			</Box>
			{task.steps.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold dimColor>
						Steps:
					</Text>
					{task.steps.map((step) => (
						<Box key={step} paddingLeft={1}>
							<Text dimColor>{step}</Text>
						</Box>
					))}
				</Box>
			)}
		</DetailPanel>
	);
}

interface TaskEditPanelProps {
	editState: EditState;
	onFieldChange: (field: EditField, value: string, stepIndex?: number) => void;
}

function TaskEditPanel({
	editState,
	onFieldChange,
}: TaskEditPanelProps): React.ReactElement | null {
	if (!editState.editedTask) {
		return null;
	}

	return (
		<DetailPanel borderColor="magenta">
			<Text bold color="magenta">
				Edit Task
			</Text>
			<Box marginTop={1}>
				<Text bold color={editState.activeField === "title" ? "cyan" : undefined}>
					Title:{" "}
				</Text>
				<TextInput
					value={editState.editedTask.title}
					onChange={(value) => onFieldChange("title", value)}
					focus={editState.activeField === "title"}
					placeholder="Task title"
				/>
			</Box>
			<Box>
				<Text bold color={editState.activeField === "description" ? "cyan" : undefined}>
					Description:{" "}
				</Text>
				<TextInput
					value={editState.editedTask.description}
					onChange={(value) => onFieldChange("description", value)}
					focus={editState.activeField === "description"}
					placeholder="Task description"
				/>
			</Box>
			{editState.editedTask.steps.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Steps:</Text>
					{editState.editedTask.steps.map((step, stepIndex) => {
						const isActiveStep =
							editState.activeField === "steps" && editState.stepIndex === stepIndex;
						const stepKey = `step-${stepIndex}`;

						return (
							<Box key={stepKey} paddingLeft={1}>
								<Text bold={isActiveStep} color={isActiveStep ? "cyan" : undefined}>
									{stepIndex + 1}.{" "}
								</Text>
								<TextInput
									value={step}
									onChange={(value) => onFieldChange("steps", value, stepIndex)}
									focus={isActiveStep}
									placeholder={`Step ${stepIndex + 1}`}
								/>
							</Box>
						);
					})}
				</Box>
			)}
		</DetailPanel>
	);
}

export function TasksView({ version, onClose }: TasksViewProps): React.ReactElement {
	const prdService = getPrdService();
	const [prd, setPrd] = useState<Prd | null>(() => prdService.get());
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [editState, setEditState] = useState<EditState>(getInitialEditState);

	const tasks = prd?.tasks ?? [];

	const { selectedIndex, setSelectedIndex, statusMessage, setStatusMessage } = useListNavigation({
		itemCount: tasks.length,
		isActive: viewMode === "list",
		onClose,
	});

	useEffect(() => {
		if (selectedIndex >= tasks.length && tasks.length > 0) {
			setSelectedIndex(Math.max(0, tasks.length - 1));
		}
	}, [tasks.length, selectedIndex, setSelectedIndex]);

	const handleStartEdit = () => {
		const maybeTask = tasks.at(selectedIndex);

		if (!maybeTask) {
			return;
		}

		setEditState({
			activeField: "title",
			stepIndex: 0,
			editedTask: { ...maybeTask, steps: [...maybeTask.steps] },
		});
		setViewMode("edit");
	};

	const handleCancelEdit = () => {
		setEditState(getInitialEditState());
		setViewMode("list");
	};

	const handleSaveEdit = () => {
		if (!editState.editedTask || !prd) {
			return;
		}

		const updatedPrd = prdService.updateTask(prd, selectedIndex, editState.editedTask);

		prdService.save(updatedPrd);
		setPrd(updatedPrd);
		setEditState(getInitialEditState());
		setViewMode("list");
		setStatusMessage(`Updated: ${editState.editedTask.title}`);
	};

	const handleEditFieldChange = (field: EditField, value: string, stepIndex?: number) => {
		if (!editState.editedTask) {
			return;
		}

		setEditState((prev) => {
			if (!prev.editedTask) {
				return prev;
			}

			if (field === "steps" && stepIndex !== undefined) {
				const newSteps = [...prev.editedTask.steps];

				newSteps[stepIndex] = value;

				return {
					...prev,
					editedTask: { ...prev.editedTask, steps: newSteps },
				};
			}

			return {
				...prev,
				editedTask: { ...prev.editedTask, [field]: value },
			};
		});
	};

	const handleNextField = () => {
		const stepsCount = editState.editedTask?.steps.length ?? 0;

		setEditState((prev) => {
			if (prev.activeField === "title") {
				return { ...prev, activeField: "description" };
			}

			if (prev.activeField === "description") {
				if (stepsCount > 0) {
					return { ...prev, activeField: "steps", stepIndex: 0 };
				}

				return { ...prev, activeField: "title" };
			}

			if (prev.activeField === "steps") {
				if (prev.stepIndex < stepsCount - 1) {
					return { ...prev, stepIndex: prev.stepIndex + 1 };
				}

				return { ...prev, activeField: "title", stepIndex: 0 };
			}

			return prev;
		});
	};

	const handlePrevField = () => {
		const stepsCount = editState.editedTask?.steps.length ?? 0;

		setEditState((prev) => {
			if (prev.activeField === "title") {
				if (stepsCount > 0) {
					return { ...prev, activeField: "steps", stepIndex: stepsCount - 1 };
				}

				return { ...prev, activeField: "description" };
			}

			if (prev.activeField === "description") {
				return { ...prev, activeField: "title" };
			}

			if (prev.activeField === "steps") {
				if (prev.stepIndex > 0) {
					return { ...prev, stepIndex: prev.stepIndex - 1 };
				}

				return { ...prev, activeField: "description", stepIndex: 0 };
			}

			return prev;
		});
	};

	useInput(
		(input, key) => {
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

					const updatedPrd = prdService.deleteTask(prd, selectedIndex);

					prdService.save(updatedPrd);
					setPrd(updatedPrd);
					setViewMode("list");

					const newSelectedIndex = Math.min(selectedIndex, updatedPrd.tasks.length - 1);

					setSelectedIndex(Math.max(0, newSelectedIndex));
					setStatusMessage(`Deleted: ${selectedTask.title}`);
				}

				return;
			}

			if (input === "d" && prd && tasks.length > 0) {
				const selectedTask = tasks.at(selectedIndex);

				if (!selectedTask) {
					return;
				}

				const updatedPrd = prdService.toggleTaskDone(prd, selectedIndex);

				prdService.save(updatedPrd);
				setPrd(updatedPrd);

				const newStatus = !selectedTask.done;
				const statusText = newStatus ? "completed" : "incomplete";

				setStatusMessage(`Task marked as ${statusText}`);
			}

			if (input === "e" && tasks.length > 0) {
				handleStartEdit();
			}

			if (input === "x" && tasks.length > 0) {
				setViewMode("confirm-delete");
			}
		},
		{ isActive: viewMode !== "edit" },
	);

	useInput(
		(_input, key) => {
			if (key.escape) {
				handleCancelEdit();
			} else if (key.tab && key.shift) {
				handlePrevField();
			} else if (key.tab) {
				handleNextField();
			} else if (key.return && (key.ctrl || key.meta)) {
				handleSaveEdit();
			}
		},
		{ isActive: viewMode === "edit" },
	);

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
								<SelectableList
									items={tasks}
									selectedIndex={selectedIndex}
									emptyMessage="No tasks found. Run /init to create a project."
									getItemKey={(task, index) => task.id ?? `task-${index}`}
									renderItem={(task, _index, isSelected) => (
										<TaskItem task={task} isSelected={isSelected} />
									)}
								/>
							</Box>
						</Box>

						{viewMode === "edit" && editState.editedTask ? (
							<TaskEditPanel editState={editState} onFieldChange={handleEditFieldChange} />
						) : (
							selectedTask && <TaskDetail task={selectedTask} />
						)}

						{viewMode === "confirm-delete" && selectedTask && (
							<ConfirmationDialog title="Delete task?" message={`"${selectedTask.title}"`} />
						)}

						{statusMessage && (
							<Box marginTop={1}>
								<Text color="green">{statusMessage}</Text>
							</Box>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<TasksFooter viewMode={viewMode} />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
