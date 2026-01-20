import { Box, Text } from "ink";
import { useAgentStore } from "@/stores/index.ts";
import { Spinner } from "./common/Spinner.tsx";

export function AgentOutput(): React.ReactElement | null {
	const isStreaming = useAgentStore((state) => state.isStreaming);
	const error = useAgentStore((state) => state.error);
	const retryCount = useAgentStore((state) => state.retryCount);
	const isRetrying = useAgentStore((state) => state.isRetrying);

	const showError = Boolean(error);
	const showRetryMessage = retryCount > 0 && !isRetrying && !error;
	const showRetryingSpinner = isRetrying;
	const showWorkingSpinner = isStreaming && !isRetrying;

	const hasContent = showError || showRetryMessage || showRetryingSpinner || showWorkingSpinner;

	if (!hasContent) {
		return null;
	}

	return (
		<Box flexDirection="column" paddingX={1}>
			{showError && (
				<Box marginBottom={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			{showRetryMessage && (
				<Box marginBottom={1}>
					<Text color="yellow">Retry attempt {retryCount}</Text>
				</Box>
			)}

			{showRetryingSpinner && (
				<Box marginBottom={1}>
					<Spinner label={`Retrying (attempt ${retryCount})...`} />
				</Box>
			)}

			{showWorkingSpinner && (
				<Box>
					<Spinner label="Agent working..." />
				</Box>
			)}
		</Box>
	);
}
