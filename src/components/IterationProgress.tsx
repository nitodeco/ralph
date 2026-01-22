import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { useAppStore, useIterationStore } from "@/stores/index.ts";
import { ProgressBar } from "./common/ProgressBar.tsx";
import { Spinner } from "./common/Spinner.tsx";

const ETA_UPDATE_INTERVAL_MS = 1_000;

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.ceil(durationMs / 1_000);

	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}

	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes < 60) {
		return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;

	return `${hours}h ${remainingMinutes}m`;
}

function estimateTimeRemaining(current: number, total: number, elapsedMs: number): number | null {
	if (current <= 0 || elapsedMs <= 0 || current >= total) {
		return null;
	}

	const averageTimePerIteration = elapsedMs / current;
	const remainingIterations = total - current;

	return averageTimePerIteration * remainingIterations;
}

export function IterationProgress(): React.ReactElement {
	const current = useIterationStore((state) => state.current);
	const total = useIterationStore((state) => state.total);
	const isRunning = useIterationStore((state) => state.isRunning);
	const isDelaying = useIterationStore((state) => state.isDelaying);
	const startTime = useIterationStore((state) => state.startTime);
	const isVerifying = useAppStore((state) => state.isVerifying);
	const lastVerificationResult = useAppStore((state) => state.lastVerificationResult);
	const lastDecomposition = useAppStore((state) => state.lastDecomposition);

	const [elapsedMs, setElapsedMs] = useState(0);

	useEffect(() => {
		if (!startTime || !isRunning) {
			return;
		}

		const interval = setInterval(() => {
			setElapsedMs(Date.now() - startTime);
		}, ETA_UPDATE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [startTime, isRunning]);

	const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
	const etaMs = estimateTimeRemaining(current, total, elapsedMs);
	const progressColor = percentage >= 100 ? "green" : percentage >= 50 ? "cyan" : "yellow";

	const getSpinnerVariant = (): "processing" | "waiting" | "progress" => {
		if (isVerifying) {
			return "processing";
		}

		if (isDelaying) {
			return "waiting";
		}

		return "progress";
	};

	const getStatusLabel = (): string => {
		if (isVerifying) {
			return "Verifying changes...";
		}

		if (isDelaying) {
			return "Preparing next iteration...";
		}

		return "Running...";
	};

	return (
		<Box flexDirection="column" paddingX={1} marginY={1}>
			<Box gap={2} marginBottom={1}>
				<Text bold color={progressColor}>
					Iteration {current}/{total}
				</Text>
				{(isRunning || isDelaying || isVerifying) && (
					<Spinner variant={getSpinnerVariant()} label={getStatusLabel()} />
				)}
			</Box>

			<Box flexDirection="column" gap={0}>
				<ProgressBar
					current={current}
					total={total}
					width={25}
					color="auto"
					style="compact"
					showPercentage
					suffix={etaMs !== null ? `ETA: ${formatDuration(etaMs)}` : undefined}
				/>

				{elapsedMs > 0 && isRunning && (
					<Text dimColor>
						Elapsed: {formatDuration(elapsedMs)}
						{current > 0 && <Text> · Avg: {formatDuration(elapsedMs / current)}/iteration</Text>}
					</Text>
				)}
			</Box>

			{lastVerificationResult && !lastVerificationResult.passed && (
				<Box marginTop={1} flexDirection="column">
					<Text color="red" bold>
						✖ Verification failed
					</Text>
					<Text color="red" dimColor>
						{lastVerificationResult.failedChecks.join(", ")}
					</Text>
				</Box>
			)}

			{lastDecomposition && (
				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">⚡ Task decomposed: "{lastDecomposition.originalTaskTitle}"</Text>
					<Text dimColor>
						Split into {lastDecomposition.suggestedSubtasks.length} subtasks ·{" "}
						{lastDecomposition.reason}
					</Text>
				</Box>
			)}
		</Box>
	);
}
