import { Box, Text, useInput } from "ink";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { performSessionArchive } from "@/lib/archive.ts";

interface ArchiveViewProps {
	version: string;
	onClose: () => void;
}

function ArchiveHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Archive
			</Text>
		</Box>
	);
}

function ArchiveFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Enter, Escape, or 'q' to close</Text>
		</Box>
	);
}

export function ArchiveView({ version, onClose }: ArchiveViewProps): React.ReactElement {
	const result = performSessionArchive();

	useInput((input, key) => {
		if (key.escape || key.return || input === "q") {
			onClose();
		}
	});

	return (
		<ResponsiveLayout
			header={<ArchiveHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
						{result.tasksArchived === 0 && !result.progressArchived ? (
							<Box flexDirection="column">
								<Text>Nothing to archive.</Text>
								<Box flexDirection="column" marginTop={1}>
									<Text dimColor>Completed tasks and progress files are archived when:</Text>
									<Box paddingLeft={2} flexDirection="column">
										<Text dimColor>• Tasks are marked as done in the PRD</Text>
										<Text dimColor>• A progress.txt file exists in .ralph/</Text>
									</Box>
								</Box>
							</Box>
						) : (
							<Box flexDirection="column">
								<Text bold color="green">
									Archive Complete
								</Text>
								<Box flexDirection="column" paddingLeft={2} marginTop={1}>
									{result.tasksArchived > 0 && (
										<Text>
											<Text color="green">✓</Text> Archived {result.tasksArchived} completed task
											{result.tasksArchived === 1 ? "" : "s"}
										</Text>
									)}
									{result.progressArchived && (
										<Text>
											<Text color="green">✓</Text> Archived progress file
										</Text>
									)}
								</Box>
								<Box marginTop={1}>
									<Text dimColor>Archived files are stored in .ralph/archive/</Text>
								</Box>
							</Box>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<ArchiveFooter />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
