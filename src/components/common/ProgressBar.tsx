import { Box, Text } from "ink";

type ProgressBarStyle = "default" | "minimal" | "detailed" | "compact";
type ProgressBarColor = "cyan" | "green" | "yellow" | "red" | "magenta" | "blue" | "auto";

interface ProgressBarProps {
	current: number;
	total: number;
	width?: number;
	showPercentage?: boolean;
	showCount?: boolean;
	showBytes?: boolean;
	label?: string;
	style?: ProgressBarStyle;
	color?: ProgressBarColor;
	suffix?: string;
}

function getAutoColor(percentage: number): string {
	if (percentage >= 100) {
		return "green";
	}

	if (percentage >= 75) {
		return "cyan";
	}

	if (percentage >= 50) {
		return "yellow";
	}

	return "gray";
}

function createProgressBar(current: number, total: number, width: number): string {
	if (total === 0) {
		return "░".repeat(width);
	}

	const ratio = Math.min(current / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	return `${"█".repeat(filled)}${"░".repeat(empty)}`;
}

function createCompactProgressBar(current: number, total: number, width: number): string {
	if (total === 0) {
		return "─".repeat(width);
	}

	const ratio = Math.min(current / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	return `${"━".repeat(filled)}${"─".repeat(empty)}`;
}

function createDetailedProgressBar(current: number, total: number, width: number): string {
	if (total === 0) {
		return `[${" ".repeat(width)}]`;
	}

	const ratio = Math.min(current / total, 1);
	const filled = Math.round(ratio * width);
	const empty = width - filled;

	return `[${"\u2588".repeat(filled)}${"\u2591".repeat(empty)}]`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}

	if (bytes < 1_024 * 1_024) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}

	return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

export function ProgressBar({
	current,
	total,
	width = 20,
	showPercentage = true,
	showCount = false,
	showBytes = false,
	label,
	style = "default",
	color = "cyan",
	suffix,
}: ProgressBarProps): React.ReactElement {
	const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
	const displayColor = color === "auto" ? getAutoColor(percentage) : color;

	const progressBarText =
		style === "compact"
			? createCompactProgressBar(current, total, width)
			: style === "detailed"
				? createDetailedProgressBar(current, total, width)
				: createProgressBar(current, total, width);

	if (style === "minimal") {
		return (
			<Box gap={1}>
				<Text color={displayColor}>{progressBarText}</Text>
				{showPercentage && <Text dimColor>{percentage}%</Text>}
			</Box>
		);
	}

	if (style === "compact") {
		return (
			<Text>
				{label && <Text dimColor>{label} </Text>}
				<Text color={displayColor}>{progressBarText}</Text>
				{showPercentage && <Text dimColor> {percentage}%</Text>}
				{suffix && <Text dimColor> {suffix}</Text>}
			</Text>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			{label && <Text dimColor>{label}</Text>}
			<Box gap={1}>
				<Text color={displayColor}>{progressBarText}</Text>
				{showPercentage && <Text dimColor>{percentage}%</Text>}
				{showCount && (
					<Text dimColor>
						({current}/{total})
					</Text>
				)}
				{showBytes && (
					<Text dimColor>
						({formatBytes(current)} / {formatBytes(total)})
					</Text>
				)}
				{suffix && <Text dimColor>{suffix}</Text>}
			</Box>
		</Box>
	);
}
