import { Box, type BoxProps } from "ink";

interface DetailPanelProps {
	borderColor?: BoxProps["borderColor"];
	children: React.ReactNode;
}

export function DetailPanel({
	borderColor = "gray",
	children,
}: DetailPanelProps): React.ReactElement {
	return (
		<Box
			flexDirection="column"
			marginTop={1}
			borderStyle="single"
			borderColor={borderColor}
			paddingX={1}
		>
			{children}
		</Box>
	);
}
