import { Box, Text } from "ink";
import { Spinner } from "./common/Spinner.tsx";

interface IterationProgressProps {
	current: number;
	total: number;
	isRunning: boolean;
	isDelaying: boolean;
}

function createProgressBar(current: number, total: number, width: number): string {
	const filled = Math.round((current / total) * width);
	const empty = width - filled;
	return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

export function IterationProgress({
	current,
	total,
	isRunning,
	isDelaying,
}: IterationProgressProps): React.ReactElement {
	const progressBar = createProgressBar(current, total, 20);
	const percentage = Math.round((current / total) * 100);

	return (
		<Box flexDirection="column" paddingX={1} marginY={1}>
			<Box gap={2}>
				<Text bold color="cyan">
					Iteration {current}/{total}
				</Text>
				{isRunning && !isDelaying && <Spinner />}
				{isDelaying && (
					<Text dimColor>
						<Spinner label="Next iteration..." />
					</Text>
				)}
			</Box>
			<Box gap={1}>
				<Text color="cyan">{progressBar}</Text>
				<Text dimColor>{percentage}%</Text>
			</Box>
		</Box>
	);
}
