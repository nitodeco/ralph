import { Box, Text, useInput } from "ink";
import { Message } from "@/components/common/Message.tsx";

interface PlanErrorPhaseProps {
	errorMessage: string;
	onClose: () => void;
}

export function PlanErrorPhase({ errorMessage, onClose }: PlanErrorPhaseProps): React.ReactElement {
	useInput((_, key) => {
		if (key.return || key.escape) {
			onClose();
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Message type="error">Error: {errorMessage}</Message>
			<Text dimColor>Press Enter to exit</Text>
		</Box>
	);
}
