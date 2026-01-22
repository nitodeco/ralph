import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import type { PlanDiffTask, PrdTask } from "@/types.ts";

const TASK_DETAIL_HEIGHT = 12;
const DEFAULT_MAX_VISIBLE_TASKS = 8;
const CONDENSED_MAX_VISIBLE_TASKS = 5;

type EditField = "title" | "description" | "steps";

interface EditState {
	isEditing: boolean;
	taskIndex: number;
	activeField: EditField;
	stepIndex: number;
	editedTask: PrdTask | null;
}

interface PlanReviewPhaseProps {
	diffTasks: PlanDiffTask[];
	onAccept: (acceptedIndices: Set<number>, editedTasks: Map<number, PrdTask>) => void;
	onCancel: () => void;
}

const STATUS_INDICATOR_BY_STATUS = {
	new: { symbol: "+", color: "green" },
	modified: { symbol: "~", color: "yellow" },
	removed: { symbol: "-", color: "red" },
	unchanged: { symbol: " ", color: "gray" },
} as const;

function buildInitialAcceptedIndices(diffTasks: PlanDiffTask[]): Set<number> {
	const initialAccepted = new Set<number>();

	for (let taskIndex = 0; taskIndex < diffTasks.length; taskIndex++) {
		const diffTask = diffTasks.at(taskIndex);

		if (diffTask && diffTask.status !== "removed") {
			initialAccepted.add(taskIndex);
		}
	}

	return initialAccepted;
}

function getInitialEditState(): EditState {
	return {
		isEditing: false,
		taskIndex: -1,
		activeField: "title",
		stepIndex: 0,
		editedTask: null,
	};
}

function getTaskForIndex(
	index: number,
	diffTasks: PlanDiffTask[],
	editedTasks: Map<number, PrdTask>,
): PrdTask | undefined {
	const maybeEditedTask = editedTasks.get(index);

	if (maybeEditedTask) {
		return maybeEditedTask;
	}

	return diffTasks.at(index)?.task;
}

interface VisibleRange {
	startIndex: number;
	endIndex: number;
	hasMoreAbove: boolean;
	hasMoreBelow: boolean;
}

function getVisibleRange(
	selectedIndex: number,
	totalItems: number,
	maxVisible: number,
): VisibleRange {
	if (totalItems <= maxVisible) {
		return {
			startIndex: 0,
			endIndex: totalItems,
			hasMoreAbove: false,
			hasMoreBelow: false,
		};
	}

	const halfWindow = Math.floor(maxVisible / 2);
	const rawStartIndex = selectedIndex - halfWindow;
	const clampedStartIndex = Math.max(0, Math.min(rawStartIndex, totalItems - maxVisible));
	const clampedEndIndex = Math.min(totalItems, clampedStartIndex + maxVisible);

	return {
		startIndex: clampedStartIndex,
		endIndex: clampedEndIndex,
		hasMoreAbove: clampedStartIndex > 0,
		hasMoreBelow: clampedEndIndex < totalItems,
	};
}

export function PlanReviewPhase({
	diffTasks,
	onAccept,
	onCancel,
}: PlanReviewPhaseProps): React.ReactElement {
	const { isNarrow } = useResponsive();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(() =>
		buildInitialAcceptedIndices(diffTasks),
	);
	const [editedTasks, setEditedTasks] = useState<Map<number, PrdTask>>(new Map());
	const [editState, setEditState] = useState<EditState>(getInitialEditState);

	const maxVisibleTasks = isNarrow ? CONDENSED_MAX_VISIBLE_TASKS : DEFAULT_MAX_VISIBLE_TASKS;
	const visibleRange = getVisibleRange(selectedIndex, diffTasks.length, maxVisibleTasks);
	const visibleTasks = diffTasks.slice(visibleRange.startIndex, visibleRange.endIndex);

	const newCount = diffTasks.filter((diffTask) => diffTask.status === "new").length;
	const modifiedCount = diffTasks.filter((diffTask) => diffTask.status === "modified").length;
	const removedCount = diffTasks.filter((diffTask) => diffTask.status === "removed").length;
	const unchangedCount = diffTasks.filter((diffTask) => diffTask.status === "unchanged").length;

	const handleToggleAccepted = (index: number) => {
		setAcceptedIndices((prev) => {
			const next = new Set(prev);

			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}

			return next;
		});
	};

	const handleStartEdit = () => {
		const maybeTask = getTaskForIndex(selectedIndex, diffTasks, editedTasks);

		if (!maybeTask) {
			return;
		}

		setEditState({
			isEditing: true,
			taskIndex: selectedIndex,
			activeField: "title",
			stepIndex: 0,
			editedTask: { ...maybeTask, steps: [...maybeTask.steps] },
		});
	};

	const handleCancelEdit = () => {
		setEditState(getInitialEditState());
	};

	const handleSaveEdit = () => {
		if (!editState.editedTask) {
			return;
		}

		setEditedTasks((prev) => {
			const next = new Map(prev);

			next.set(editState.taskIndex, editState.editedTask as PrdTask);

			return next;
		});
		setEditState(getInitialEditState());
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

				return prev;
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
			if (key.upArrow) {
				setSelectedIndex((prev) => Math.max(0, prev - 1));
			} else if (key.downArrow) {
				setSelectedIndex((prev) => Math.min(diffTasks.length - 1, prev + 1));
			} else if (input === " ") {
				handleToggleAccepted(selectedIndex);
			} else if (input === "e") {
				handleStartEdit();
			} else if (key.return || input === "y") {
				onAccept(acceptedIndices, editedTasks);
			} else if (key.escape || input === "q") {
				onCancel();
			}
		},
		{ isActive: !editState.isEditing },
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
		{ isActive: editState.isEditing },
	);

	const selectedDiffTask = diffTasks.at(selectedIndex);
	const displayTask = getTaskForIndex(selectedIndex, diffTasks, editedTasks);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold>Review Generated PRD</Text>

			<Box gap={2}>
				{newCount > 0 && <Text color="green">+{newCount} new</Text>}
				{modifiedCount > 0 && <Text color="yellow">~{modifiedCount} modified</Text>}
				{removedCount > 0 && <Text color="red">-{removedCount} removed</Text>}
				{unchangedCount > 0 && <Text dimColor>{unchangedCount} unchanged</Text>}
			</Box>

			<Box flexDirection="column" marginTop={1}>
				<Text dimColor>
					Tasks:{" "}
					{diffTasks.length > maxVisibleTasks && (
						<Text>
							({selectedIndex + 1}/{diffTasks.length})
						</Text>
					)}
				</Text>
				<Box
					flexDirection="column"
					borderStyle="round"
					borderColor="gray"
					paddingX={1}
					marginTop={1}
				>
					{visibleRange.hasMoreAbove && (
						<Text dimColor>↑ {visibleRange.startIndex} more above</Text>
					)}
					{visibleTasks.map((diffTask, visibleIndex) => {
						const actualIndex = visibleRange.startIndex + visibleIndex;
						const maybeEditedTask = editedTasks.get(actualIndex);
						const taskToDisplay = maybeEditedTask ?? diffTask.task;
						const isEdited = maybeEditedTask !== undefined;
						const indicator = STATUS_INDICATOR_BY_STATUS[diffTask.status];
						const isSelected = actualIndex === selectedIndex;
						const isAccepted = acceptedIndices.has(actualIndex);
						const checkboxSymbol = isAccepted ? "✓" : "○";
						const checkboxColor = isAccepted ? "green" : "gray";

						return (
							<Box key={diffTask.task.title} gap={1}>
								<Text color={indicator.color}>{indicator.symbol}</Text>
								<Text color={checkboxColor}>{checkboxSymbol}</Text>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{isSelected ? "▸ " : "  "}
									{taskToDisplay.title}
									{isEdited && <Text color="magenta"> (edited)</Text>}
									{taskToDisplay.done && <Text dimColor> (done)</Text>}
								</Text>
							</Box>
						);
					})}
					{visibleRange.hasMoreBelow && (
						<Text dimColor>↓ {diffTasks.length - visibleRange.endIndex} more below</Text>
					)}
				</Box>
			</Box>

			<Box flexDirection="column" marginTop={1} height={TASK_DETAIL_HEIGHT}>
				{editState.isEditing && editState.editedTask ? (
					<>
						<Text dimColor>Edit Task:</Text>
						<Box
							flexDirection="column"
							borderStyle="round"
							borderColor="magenta"
							paddingX={1}
							marginTop={1}
						>
							<Box>
								<Text bold color={editState.activeField === "title" ? "cyan" : undefined}>
									Title:{" "}
								</Text>
								<TextInput
									value={editState.editedTask.title}
									onChange={(value) => handleEditFieldChange("title", value)}
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
									onChange={(value) => handleEditFieldChange("description", value)}
									focus={editState.activeField === "description"}
									placeholder="Task description"
								/>
							</Box>
							{editState.editedTask.steps.length > 0 && (
								<Box flexDirection="column">
									<Text bold>Steps:</Text>
									{editState.editedTask.steps.map((step, stepIndex) => {
										const isActiveStep =
											editState.activeField === "steps" && editState.stepIndex === stepIndex;
										const stepKey = `${editState.taskIndex}-step-${stepIndex}`;

										return (
											<Box key={stepKey}>
												<Text bold={isActiveStep} color={isActiveStep ? "cyan" : undefined}>
													{"  "}
													{stepIndex + 1}.{" "}
												</Text>
												<TextInput
													value={step}
													onChange={(value) => handleEditFieldChange("steps", value, stepIndex)}
													focus={isActiveStep}
													placeholder={`Step ${stepIndex + 1}`}
												/>
											</Box>
										);
									})}
								</Box>
							)}
						</Box>
					</>
				) : (
					selectedDiffTask &&
					displayTask && (
						<>
							<Text dimColor>Details:</Text>
							<Box
								flexDirection="column"
								borderStyle="round"
								borderColor="cyan"
								paddingX={1}
								marginTop={1}
							>
								<Text>
									<Text bold>Title:</Text> {displayTask.title}
								</Text>
								<Text>
									<Text bold>Status:</Text>{" "}
									<Text color={STATUS_INDICATOR_BY_STATUS[selectedDiffTask.status].color}>
										{selectedDiffTask.status}
									</Text>
									{editedTasks.has(selectedIndex) && <Text color="magenta"> (edited)</Text>}
								</Text>
								<Text>
									<Text bold>Description:</Text> {displayTask.description}
								</Text>
								{displayTask.steps.length > 0 && (
									<Box flexDirection="column">
										<Text bold>Steps:</Text>
										{displayTask.steps.map((step, stepIndex) => (
											<Text key={`${displayTask.title}-step-${stepIndex}`}>
												{"  "}
												{stepIndex + 1}. {step}
											</Text>
										))}
									</Box>
								)}

								{selectedDiffTask.status === "modified" && selectedDiffTask.originalTask && (
									<Box flexDirection="column" marginTop={1}>
										<Text bold color="yellow">
											Original:
										</Text>
										<Text dimColor>Description: {selectedDiffTask.originalTask.description}</Text>
										{selectedDiffTask.originalTask.steps.length > 0 && (
											<Box flexDirection="column">
												<Text dimColor>Steps:</Text>
												{selectedDiffTask.originalTask.steps.map((step, stepIndex) => (
													<Text
														key={`${selectedDiffTask.originalTask?.title}-orig-step-${stepIndex}`}
														dimColor
													>
														{"  "}
														{stepIndex + 1}. {step}
													</Text>
												))}
											</Box>
										)}
									</Box>
								)}
							</Box>
						</>
					)
				)}
			</Box>

			<Box marginTop={1} gap={2} height={1}>
				{editState.isEditing ? (
					<>
						<Text dimColor>Tab Next field</Text>
						<Text dimColor>Shift+Tab Previous</Text>
						<Text dimColor>Ctrl+Enter Save</Text>
						<Text dimColor>Esc Cancel</Text>
					</>
				) : (
					<>
						<Text dimColor>↑/↓ Navigate</Text>
						<Text dimColor>Space Toggle</Text>
						<Text dimColor>e Edit</Text>
						<Text dimColor>Enter/y Accept</Text>
						<Text dimColor>q/Esc Cancel</Text>
					</>
				)}
			</Box>
		</Box>
	);
}
