import { Box, Static, Text } from "ink";
import { Spinner } from "./common/Spinner.tsx";

interface AgentOutputProps {
	output: string;
	isStreaming: boolean;
	error?: string | null;
}

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

export function AgentOutput({
	output,
	isStreaming,
	error,
}: AgentOutputProps): React.ReactElement {
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

			<Static items={completedLines}>
				{(line) => (
					<Text key={line.id} wrap="wrap">
						{line.content}
					</Text>
				)}
			</Static>

			{currentLine && (
				<Text wrap="wrap">
					{currentLine.content}
					{isStreaming && <Text color="cyan">▌</Text>}
				</Text>
			)}

			{isStreaming && !output && (
				<Box>
					<Spinner label="Starting agent..." />
				</Box>
			)}
		</Box>
	);
}
