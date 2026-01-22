import { Box, Text, useInput } from "ink";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { performSessionArchive } from "@/lib/archive.ts";
import { getSessionService } from "@/lib/services/index.ts";

interface ConfirmClearViewProps {
	onConfirm: (result: ClearResult) => void;
	onCancel: () => void;
}

export interface ClearResult {
	tasksArchived: number;
	progressArchived: boolean;
}

export function ConfirmClearView({
	onConfirm,
	onCancel,
}: ConfirmClearViewProps): React.ReactElement {
	useInput((_input, key) => {
		if (key.escape) {
			onCancel();

			return;
		}

		if (key.return) {
			const archiveResult = performSessionArchive();

			getSessionService().delete();

			onConfirm({
				tasksArchived: archiveResult.tasksArchived,
				progressArchived: archiveResult.progressArchived,
			});
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph - Clear Session
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Text>This will:</Text>
				<Box flexDirection="column" marginLeft={2} marginTop={1}>
					<Text>• Archive completed tasks and progress</Text>
					<Text>• Delete the current session data</Text>
					<Text>• Reset the session state</Text>
				</Box>

				<ConfirmationDialog title="Clear session?" message="This action cannot be undone." />
			</Box>
		</Box>
	);
}
