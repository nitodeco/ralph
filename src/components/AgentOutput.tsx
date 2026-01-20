import { Box, Static, Text } from "ink";
import { useAgentStore } from "@/stores/index.ts";
import { Spinner } from "./common/Spinner.tsx";

interface OutputLine {
	id: string;
	content: string;
}

function parseOutputLines(output: string): OutputLine[] {
	return output.split("\n").map((line, index) => ({
		id: `line-${index}`,
		content: line,
	}));
}

export function AgentOutput(): React.ReactElement {
	const output = useAgentStore((state) => state.output);
	const isStreaming = useAgentStore((state) => state.isStreaming);
	const error = useAgentStore((state) => state.error);
	const retryCount = useAgentStore((state) => state.retryCount);
	const isRetrying = useAgentStore((state) => state.isRetrying);

	const lines = parseOutputLines(output);
	const completedLines = isStreaming ? lines.slice(0, -1) : lines;
	const currentLine = isStreaming ? lines[lines.length - 1] : null;

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
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

			<Static items={completedLines}>
				{(line) => (
					<Text key={line.id} wrap="wrap" dimColor={isStreaming}>
						{line.content}
					</Text>
				)}
			</Static>

			{currentLine && (
				<Text wrap="wrap" dimColor>
					{currentLine.content}
				</Text>
			)}

			{isStreaming && !output && !isRetrying && (
				<Box>
					<Text dimColor>Starting agent...</Text>
				</Box>
			)}
		</Box>
	);
}
