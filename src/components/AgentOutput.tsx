import { Box, Text } from "ink";
import { useAgentStore } from "@/stores/index.ts";
import { Spinner } from "./common/Spinner.tsx";

export function AgentOutput(): React.ReactElement {
	const isStreaming = useAgentStore((state) => state.isStreaming);
	const error = useAgentStore((state) => state.error);
	const retryCount = useAgentStore((state) => state.retryCount);
	const isRetrying = useAgentStore((state) => state.isRetrying);

	return (
		<Box flexDirection="column" paddingX={1}>
			{error && (
				<Box marginBottom={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			)}

			{retryCount > 0 && !isRetrying && !error && (
				<Box marginBottom={1}>
					<Text color="yellow">Retry attempt {retryCount}</Text>
				</Box>
			)}

			{isRetrying && (
				<Box marginBottom={1}>
					<Spinner label={`Retrying (attempt ${retryCount})...`} />
				</Box>
			)}

			{isStreaming && !isRetrying && (
				<Box>
					<Spinner label="Agent working..." />
				</Box>
			)}
		</Box>
	);
}
