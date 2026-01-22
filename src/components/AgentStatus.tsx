import { Box, Text } from "ink";
import { useEffect, useRef, useState } from "react";
import type { AgentPhase } from "@/lib/agent-phase.ts";
import { PHASE_INFO_BY_PHASE } from "@/lib/agent-phase.ts";
import { useAgentStatusStore } from "@/stores/agentStatusStore.ts";
import { useAgentStore } from "@/stores/index.ts";
import { PhaseIndicator } from "./common/PhaseIndicator.tsx";
import { Spinner } from "./common/Spinner.tsx";

const DURATION_DISPLAY_THRESHOLD_MS = 5_000;
const DURATION_UPDATE_INTERVAL_MS = 1_000;

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.floor(durationMs / 1_000);

	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}

	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	return `${minutes}m ${seconds}s`;
}

type SpinnerVariant = "default" | "processing" | "thinking" | "warning" | "error" | "network";

function getSpinnerVariantForPhase(phase: AgentPhase): SpinnerVariant {
	const VARIANT_BY_PHASE: Record<AgentPhase, SpinnerVariant> = {
		starting: "default",
		exploring: "thinking",
		reading: "processing",
		implementing: "processing",
		running_commands: "default",
		verifying: "processing",
		committing: "network",
		idle: "default",
	};

	return VARIANT_BY_PHASE[phase];
}

interface FileChangesDisplayProps {
	filesCreated: number;
	filesModified: number;
	filesDeleted: number;
}

function FileChangesDisplay({
	filesCreated,
	filesModified,
	filesDeleted,
}: FileChangesDisplayProps): React.ReactElement | null {
	const hasChanges = filesCreated > 0 || filesModified > 0 || filesDeleted > 0;

	if (!hasChanges) {
		return null;
	}

	return (
		<Box gap={2} marginTop={1}>
			{filesCreated > 0 && <Text color="green">+{filesCreated} created</Text>}
			{filesModified > 0 && <Text color="yellow">~{filesModified} modified</Text>}
			{filesDeleted > 0 && <Text color="red">-{filesDeleted} deleted</Text>}
		</Box>
	);
}

export function AgentStatus(): React.ReactElement | null {
	const isStreaming = useAgentStore((state) => state.isStreaming);
	const error = useAgentStore((state) => state.error);
	const retryCount = useAgentStore((state) => state.retryCount);
	const isRetrying = useAgentStore((state) => state.isRetrying);

	const currentPhase = useAgentStatusStore((state) => state.currentPhase);
	const fileChanges = useAgentStatusStore((state) => state.fileChanges);
	const getPhaseDurationMs = useAgentStatusStore((state) => state.getPhaseDurationMs);

	const [phaseDurationMs, setPhaseDurationMs] = useState(0);
	const completedPhasesRef = useRef<Set<AgentPhase>>(new Set());
	const lastPhaseRef = useRef<AgentPhase>("idle");

	useEffect(() => {
		if (!isStreaming) {
			setPhaseDurationMs(0);
			completedPhasesRef.current.clear();
			lastPhaseRef.current = "idle";

			return;
		}

		const interval = setInterval(() => {
			setPhaseDurationMs(getPhaseDurationMs());
		}, DURATION_UPDATE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [isStreaming, getPhaseDurationMs]);

	useEffect(() => {
		if (currentPhase !== lastPhaseRef.current && lastPhaseRef.current !== "idle") {
			completedPhasesRef.current.add(lastPhaseRef.current);
		}

		lastPhaseRef.current = currentPhase;
	}, [currentPhase]);

	useEffect(() => {
		setPhaseDurationMs(0);
	}, []);

	const showError = Boolean(error);
	const showRetryMessage = retryCount > 0 && !isRetrying && !error;
	const showRetryingSpinner = isRetrying;
	const showWorkingSpinner = isStreaming && !isRetrying;

	const hasContent = showError || showRetryMessage || showRetryingSpinner || showWorkingSpinner;

	if (!hasContent) {
		return null;
	}

	const phaseInfo = PHASE_INFO_BY_PHASE[currentPhase];
	const showDuration = phaseDurationMs >= DURATION_DISPLAY_THRESHOLD_MS;
	const spinnerVariant = getSpinnerVariantForPhase(currentPhase);
	const completedPhases = Array.from(completedPhasesRef.current);

	return (
		<Box flexDirection="column" paddingX={1}>
			{showError && (
				<Box marginBottom={1} flexDirection="column">
					<Text color="red" bold>
						✖ Error
					</Text>
					<Text color="red">{error}</Text>
				</Box>
			)}

			{showRetryMessage && (
				<Box marginBottom={1}>
					<Text color="yellow">⟳ Retry attempt {retryCount}</Text>
				</Box>
			)}

			{showRetryingSpinner && (
				<Box marginBottom={1}>
					<Spinner variant="warning" label={`Retrying (attempt ${retryCount})...`} />
				</Box>
			)}

			{showWorkingSpinner && (
				<Box flexDirection="column" gap={1}>
					<Box gap={2}>
						<Spinner variant={spinnerVariant} label={phaseInfo.activeLabel} />
						{showDuration && <Text dimColor>({formatDuration(phaseDurationMs)})</Text>}
					</Box>

					<PhaseIndicator
						currentPhase={currentPhase}
						completedPhases={completedPhases}
						style="auto"
					/>

					<FileChangesDisplay
						filesCreated={fileChanges.filesCreated}
						filesModified={fileChanges.filesModified}
						filesDeleted={fileChanges.filesDeleted}
					/>
				</Box>
			)}
		</Box>
	);
}
