import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { PlanDiffTask } from "@/types.ts";

interface PlanReviewPhaseProps {
	diffTasks: PlanDiffTask[];
	onAccept: (acceptedIndices: Set<number>) => void;
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

export function PlanReviewPhase({
	diffTasks,
	onAccept,
	onCancel,
}: PlanReviewPhaseProps): React.ReactElement {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(() =>
		buildInitialAcceptedIndices(diffTasks),
	);

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

	useInput((input, key) => {
		if (key.upArrow) {
			setSelectedIndex((prev) => Math.max(0, prev - 1));
		} else if (key.downArrow) {
			setSelectedIndex((prev) => Math.min(diffTasks.length - 1, prev + 1));
		} else if (input === " ") {
			handleToggleAccepted(selectedIndex);
		} else if (key.return || input === "y") {
			onAccept(acceptedIndices);
		} else if (key.escape || input === "q") {
			onCancel();
		}
	});

	const selectedTask = diffTasks.at(selectedIndex);

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
				<Text dimColor>Tasks:</Text>
				<Box
					flexDirection="column"
					borderStyle="round"
					borderColor="gray"
					paddingX={1}
					marginTop={1}
				>
					{diffTasks.map((diffTask, index) => {
						const indicator = STATUS_INDICATOR_BY_STATUS[diffTask.status];
						const isSelected = index === selectedIndex;
						const isAccepted = acceptedIndices.has(index);
						const checkboxSymbol = isAccepted ? "✓" : "○";
						const checkboxColor = isAccepted ? "green" : "gray";

						return (
							<Box key={diffTask.task.title} gap={1}>
								<Text color={indicator.color}>{indicator.symbol}</Text>
								<Text color={checkboxColor}>{checkboxSymbol}</Text>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{isSelected ? "▸ " : "  "}
									{diffTask.task.title}
									{diffTask.task.done && <Text dimColor> (done)</Text>}
								</Text>
							</Box>
						);
					})}
				</Box>
			</Box>

			{selectedTask && (
				<Box flexDirection="column" marginTop={1}>
					<Text dimColor>Details:</Text>
					<Box
						flexDirection="column"
						borderStyle="round"
						borderColor="cyan"
						paddingX={1}
						marginTop={1}
					>
						<Text>
							<Text bold>Title:</Text> {selectedTask.task.title}
						</Text>
						<Text>
							<Text bold>Status:</Text>{" "}
							<Text color={STATUS_INDICATOR_BY_STATUS[selectedTask.status].color}>
								{selectedTask.status}
							</Text>
						</Text>
						<Text>
							<Text bold>Description:</Text> {selectedTask.task.description}
						</Text>
						{selectedTask.task.steps.length > 0 && (
							<Box flexDirection="column">
								<Text bold>Steps:</Text>
								{selectedTask.task.steps.map((step, stepIndex) => (
									<Text key={step}>
										{"  "}
										{stepIndex + 1}. {step}
									</Text>
								))}
							</Box>
						)}

						{selectedTask.status === "modified" && selectedTask.originalTask && (
							<Box flexDirection="column" marginTop={1}>
								<Text bold color="yellow">
									Original:
								</Text>
								<Text dimColor>Description: {selectedTask.originalTask.description}</Text>
								{selectedTask.originalTask.steps.length > 0 && (
									<Box flexDirection="column">
										<Text dimColor>Steps:</Text>
										{selectedTask.originalTask.steps.map((step, stepIndex) => (
											<Text key={step} dimColor>
												{"  "}
												{stepIndex + 1}. {step}
											</Text>
										))}
									</Box>
								)}
							</Box>
						)}
					</Box>
				</Box>
			)}

			<Box marginTop={1} gap={2}>
				<Text dimColor>↑/↓ Navigate</Text>
				<Text dimColor>Space Toggle</Text>
				<Text dimColor>Enter/y Accept</Text>
				<Text dimColor>q/Esc Cancel</Text>
			</Box>
		</Box>
	);
}
