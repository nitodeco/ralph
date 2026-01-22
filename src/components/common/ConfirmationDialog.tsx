import { Box, Text } from "ink";

interface ConfirmationDialogProps {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
}

export function ConfirmationDialog({
	title,
	message,
	confirmText = "Press Enter to confirm, Escape to cancel",
	cancelText,
}: ConfirmationDialogProps): React.ReactElement {
	return (
		<Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="red" paddingX={1}>
			<Text bold color="red">
				{title}
			</Text>
			<Box marginTop={1}>
				<Text>{message}</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor>{cancelText ?? confirmText}</Text>
			</Box>
		</Box>
	);
}
