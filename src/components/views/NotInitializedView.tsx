import { Box, Text } from "ink";
import { ResponsiveLayout, useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import type { ValidationWarning } from "@/types.ts";
import { type CommandArgs, CommandInput, type SlashCommand } from "../CommandInput.tsx";
import { Message } from "../common/Message.tsx";
import { Header } from "../Header.tsx";

interface NotInitializedViewProps {
	version: string;
	validationWarning: ValidationWarning;
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
}

function NotInitializedHeader({ version }: { version: string }): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return <Header version={version} variant={headerVariant} />;
}

function NotInitializedFooter({
	onCommand,
}: {
	onCommand: (command: SlashCommand, args?: CommandArgs) => void;
}): React.ReactElement {
	return <CommandInput onCommand={onCommand} />;
}

export function NotInitializedView({
	version,
	validationWarning,
	onCommand,
}: NotInitializedViewProps): React.ReactElement {
	return (
		<ResponsiveLayout
			header={<NotInitializedHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Message type="warning">{validationWarning.message}</Message>
						<Text dimColor>{validationWarning.hint}</Text>
					</Box>
				</ScrollableContent>
			}
			footer={<NotInitializedFooter onCommand={onCommand} />}
			headerHeight={10}
			footerHeight={2}
		/>
	);
}
