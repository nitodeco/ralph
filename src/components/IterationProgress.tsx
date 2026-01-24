import { Box, Text } from "ink";
import {
	PROGRESS_COLOR_THRESHOLD_COMPLETE,
	PROGRESS_COLOR_THRESHOLD_MEDIUM,
} from "@/lib/constants/ui.ts";
import { useAppStore, useIterationStore } from "@/stores/index.ts";
import { useResponsive } from "./common/ResponsiveLayout.tsx";
import { Spinner } from "./common/Spinner.tsx";

export function IterationProgress(): React.ReactElement {
	const { isNarrow } = useResponsive();

	const current = useIterationStore((state) => state.current);
	const total = useIterationStore((state) => state.total);
	const isRunning = useIterationStore((state) => state.isRunning);
	const isDelaying = useIterationStore((state) => state.isDelaying);
	const isVerifying = useAppStore((state) => state.isVerifying);
	const lastVerificationResult = useAppStore((state) => state.lastVerificationResult);
	const lastDecomposition = useAppStore((state) => state.lastDecomposition);

	const percentage = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
	const progressColor =
		percentage >= PROGRESS_COLOR_THRESHOLD_COMPLETE
			? "green"
			: percentage >= PROGRESS_COLOR_THRESHOLD_MEDIUM
				? "cyan"
				: "yellow";

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
			return isNarrow ? "Verify..." : "Verifying changes...";
		}

		if (isDelaying) {
			return isNarrow ? "Prep..." : "Preparing next iteration...";
		}

		return isNarrow ? "Run..." : "Running...";
	};

	if (isNarrow) {
		return (
			<Box flexDirection="column" paddingX={1} marginY={1}>
				<Box gap={1}>
					<Text bold color={progressColor}>
						{current}/{total}
					</Text>
					{(isRunning || isDelaying || isVerifying) && (
						<Spinner variant={getSpinnerVariant()} label={getStatusLabel()} />
					)}
				</Box>

				{lastVerificationResult && !lastVerificationResult.passed && (
					<Box marginTop={1}>
						<Text color="red">✖ Verify fail</Text>
					</Box>
				)}
			</Box>
		);
	}

	return (
		<Box flexDirection="column" paddingX={1} marginY={1}>
			<Box gap={2}>
				<Text bold color={progressColor}>
					Iteration {current}/{total}
				</Text>
				{(isRunning || isDelaying || isVerifying) && (
					<Spinner variant={getSpinnerVariant()} label={getStatusLabel()} />
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
