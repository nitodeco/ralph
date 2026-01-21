import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { PHASE_INFO_BY_PHASE } from "@/lib/agent-phase.ts";
import { useAgentStatusStore } from "@/stores/agentStatusStore.ts";
import { useAgentStore } from "@/stores/index.ts";
import { Spinner } from "./common/Spinner.tsx";

const DURATION_DISPLAY_THRESHOLD_MS = 5_000;
const DURATION_UPDATE_INTERVAL_MS = 1_000;

function formatDurationSeconds(durationMs: number): string {
	const seconds = Math.floor(durationMs / 1_000);

	return `${seconds}s`;
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

	const parts: string[] = [];

	if (filesCreated > 0) {
		parts.push(`+${filesCreated} created`);
	}

	if (filesModified > 0) {
		parts.push(`~${filesModified} modified`);
	}

	if (filesDeleted > 0) {
		parts.push(`-${filesDeleted} deleted`);
	}

	return (
		<Box marginTop={1}>
			<Text dimColor>{parts.join(", ")}</Text>
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

	useEffect(() => {
		if (!isStreaming) {
			setPhaseDurationMs(0);

			return;
		}

		const interval = setInterval(() => {
			setPhaseDurationMs(getPhaseDurationMs());
		}, DURATION_UPDATE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [isStreaming, getPhaseDurationMs]);

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
	const durationSuffix = showDuration ? ` (${formatDurationSeconds(phaseDurationMs)})` : "";
	const statusLabel = `${phaseInfo.activeLabel}...${durationSuffix}`;

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
				<Box flexDirection="column">
					<Box>
						<Spinner label={statusLabel} />
					</Box>
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
