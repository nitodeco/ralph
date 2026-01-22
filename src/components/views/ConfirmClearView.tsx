import { Box, Text, useInput } from "ink";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
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

function ConfirmClearHeader(): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph - Clear Session
			</Text>
		</Box>
	);
}

function ConfirmClearFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Enter to confirm, Escape to cancel</Text>
		</Box>
	);
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
		<ResponsiveLayout
			header={<ConfirmClearHeader />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Text>This will:</Text>
						<Box flexDirection="column" marginLeft={2} marginTop={1}>
							<Text>• Archive completed tasks and progress</Text>
							<Text>• Delete the current session data</Text>
							<Text>• Reset the session state</Text>
						</Box>

						<ConfirmationDialog title="Clear session?" message="This action cannot be undone." />
					</Box>
				</ScrollableContent>
			}
			footer={<ConfirmClearFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
