import { Box, useStdout } from "ink";
import { useEffect, useState } from "react";

interface FixedLayoutProps {
	header: React.ReactNode;
	content: React.ReactNode;
	footer: React.ReactNode;
	headerHeight?: number;
	footerHeight?: number;
	minContentHeight?: number;
}

interface TerminalDimensions {
	rows: number;
	columns: number;
}

function getTerminalDimensions(stdout: NodeJS.WriteStream): TerminalDimensions {
	return {
		rows: stdout.rows ?? 24,
		columns: stdout.columns ?? 80,
	};
}

export function FixedLayout({
	header,
	content,
	footer,
	headerHeight = 10,
	footerHeight = 6,
	minContentHeight = 4,
}: FixedLayoutProps): React.ReactElement {
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState<TerminalDimensions>(() =>
		getTerminalDimensions(stdout),
	);

	useEffect(() => {
		const handleResize = () => {
			setDimensions(getTerminalDimensions(stdout));
		};

		stdout.on("resize", handleResize);

		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	const calculatedContentHeight = Math.max(
		minContentHeight,
		dimensions.rows - headerHeight - footerHeight,
	);

	return (
		<Box flexDirection="column" height={dimensions.rows}>
			<Box flexDirection="column" flexShrink={0}>
				{header}
			</Box>
			<Box flexDirection="column" height={calculatedContentHeight} overflowY="hidden">
				{content}
			</Box>
			<Box flexDirection="column" flexShrink={0}>
				{footer}
			</Box>
		</Box>
	);
}
