import { Box } from "ink";

interface ScrollableContentProps {
	children: React.ReactNode;
	height?: number;
}

export function ScrollableContent({
	children,
	height,
}: ScrollableContentProps): React.ReactElement {
	return (
		<Box flexDirection="column" height={height} overflowY="hidden" flexGrow={1}>
			{children}
		</Box>
	);
}
