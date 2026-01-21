import { Box, Text } from "ink";
import { useAppStore, useIterationStore } from "@/stores/index.ts";
import { Spinner } from "./common/Spinner.tsx";

function createProgressBar(current: number, total: number, width: number): string {
	if (total <= 0) {
		return "░".repeat(width);
	}

	const ratio = Math.min(current / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

export function IterationProgress(): React.ReactElement {
	const current = useIterationStore((state) => state.current);
	const total = useIterationStore((state) => state.total);
	const isRunning = useIterationStore((state) => state.isRunning);
	const isDelaying = useIterationStore((state) => state.isDelaying);
	const isVerifying = useAppStore((state) => state.isVerifying);
	const lastVerificationResult = useAppStore((state) => state.lastVerificationResult);
	const lastDecomposition = useAppStore((state) => state.lastDecomposition);

	const progressBar = createProgressBar(current, total, 20);
	const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;

	return (
		<Box flexDirection="column" paddingX={1} marginY={1}>
			<Box gap={2}>
				<Text bold color="cyan">
					Iteration {current}/{total}
				</Text>
				{isVerifying && <Spinner label="Verifying..." />}
				{isRunning && !isDelaying && !isVerifying && <Spinner />}
				{isDelaying && !isVerifying && (
					<Text dimColor>
						<Spinner label="Next iteration..." />
					</Text>
				)}
			</Box>
			<Box gap={1}>
				<Text color="cyan">{progressBar}</Text>
				<Text dimColor>{percentage}%</Text>
			</Box>
			{lastVerificationResult && !lastVerificationResult.passed && (
				<Box marginTop={1}>
					<Text color="red">
						Verification failed: {lastVerificationResult.failedChecks.join(", ")}
					</Text>
				</Box>
			)}
			{lastDecomposition && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">
						Task decomposed: "{lastDecomposition.originalTaskTitle}" split into{" "}
						{lastDecomposition.suggestedSubtasks.length} subtasks
					</Text>
					<Text dimColor>Reason: {lastDecomposition.reason}</Text>
				</Box>
			)}
		</Box>
	);
}
