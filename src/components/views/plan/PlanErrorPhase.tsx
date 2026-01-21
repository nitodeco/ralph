import { Box, Text, useInput } from "ink";

import { Message } from "@/components/common/Message.tsx";

interface PlanErrorPhaseProps {
	errorMessage: string;
	onRetry: () => void;
	onClose: () => void;
}

export function PlanErrorPhase({
	errorMessage,
	onRetry,
	onClose,
}: PlanErrorPhaseProps): React.ReactElement {
	useInput((input, key) => {
		if (key.return || input === "r") {
			onRetry();
		} else if (key.escape || input === "q") {
			onClose();
		}
	});

	return (
		<Box flexDirection="column" gap={1}>
			<Message type="error">Error: {errorMessage}</Message>
			<Box marginTop={1} gap={2}>
				<Text dimColor>Enter/r Retry</Text>
				<Text dimColor>q/Esc Exit</Text>
			</Box>
		</Box>
	);
}
