import { Box, Text } from "ink";

interface ProgressBarProps {
	current: number;
	total: number;
	width?: number;
	showPercentage?: boolean;
	label?: string;
}

function createProgressBar(current: number, total: number, width: number): string {
	if (total === 0) return "░".repeat(width);
	const filled = Math.round((current / total) * width);
	const empty = width - filled;
	return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProgressBar({
	current,
	total,
	width = 20,
	showPercentage = true,
	label,
}: ProgressBarProps): React.ReactElement {
	const progressBar = createProgressBar(current, total, width);
	const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

	return (
		<Box flexDirection="column" gap={1}>
			{label && <Text dimColor>{label}</Text>}
			<Box gap={1}>
				<Text color="cyan">{progressBar}</Text>
				{showPercentage && <Text dimColor>{percentage}%</Text>}
				<Text dimColor>
					({formatBytes(current)} / {formatBytes(total)})
				</Text>
			</Box>
		</Box>
	);
}
