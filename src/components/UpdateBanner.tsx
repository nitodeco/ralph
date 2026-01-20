import { Box, Text } from "ink";

interface UpdateBannerProps {
	currentVersion: string;
	latestVersion: string;
	onDismiss?: () => void;
}

export function UpdateBanner({
	currentVersion,
	latestVersion,
}: UpdateBannerProps): React.ReactElement {
	return (
		<Box paddingX={1} marginBottom={1}>
			<Text dimColor>
				Update available: <Text color="gray">{currentVersion}</Text>
				{" → "}
				<Text color="green">{latestVersion}</Text>
				{" · "}
				Type <Text color="cyan">/update</Text> to install or{" "}
				<Text color="cyan">/dismiss-update</Text> to hide
			</Text>
		</Box>
	);
}
