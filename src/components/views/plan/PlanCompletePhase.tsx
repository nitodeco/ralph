import { Box, Text, useInput } from "ink";
import { Message } from "@/components/common/Message.tsx";
import type { Prd } from "@/types.ts";

interface PlanCompletePhaseProps {
	prd: Prd;
	onClose: () => void;
}

export function PlanCompletePhase({ prd, onClose }: PlanCompletePhaseProps): React.ReactElement {
	useInput((_, key) => {
		if (key.return || key.escape) {
			onClose();
		}
	});

	const doneCount = prd.tasks.filter((t) => t.done).length;
	const pendingCount = prd.tasks.length - doneCount;

	return (
		<Box flexDirection="column" gap={1}>
			<Message type="success">PRD updated successfully!</Message>

			<Box flexDirection="column" marginTop={1}>
				<Text>
					<Text dimColor>Project:</Text> <Text color="yellow">{prd.project}</Text>
				</Text>
				<Text>
					<Text dimColor>Total tasks:</Text> {prd.tasks.length}
				</Text>
				<Text>
					<Text dimColor>Pending:</Text> {pendingCount}
				</Text>
				<Text>
					<Text dimColor>Done:</Text> {doneCount}
				</Text>
			</Box>

			{prd.tasks.length > 0 && (
				<Box flexDirection="column" marginTop={1}>
					<Text dimColor>Tasks:</Text>
					{prd.tasks.map((task, index) => (
						<Text key={task.title}>
							{"  "}
							{index + 1}. {task.title}
							{task.done && <Text color="green"> ✓</Text>}
						</Text>
					))}
				</Box>
			)}

			<Box marginTop={1}>
				<Text dimColor>Press Enter to continue</Text>
			</Box>
		</Box>
	);
}
