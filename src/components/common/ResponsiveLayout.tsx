import { Box, useStdout } from "ink";
import { createContext, useContext, useEffect, useState } from "react";

export type TerminalBreakpoint = "narrow" | "medium" | "wide";

export interface ResponsiveContextValue {
	width: number;
	height: number;
	breakpoint: TerminalBreakpoint;
	isNarrow: boolean;
	isMedium: boolean;
	isWide: boolean;
	contentWidth: number;
}

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;

const NARROW_MAX_WIDTH = 60;
const MEDIUM_MAX_WIDTH = 100;

const HORIZONTAL_PADDING = 2;

const ResponsiveContext = createContext<ResponsiveContextValue>({
	width: DEFAULT_WIDTH,
	height: DEFAULT_HEIGHT,
	breakpoint: "medium",
	isNarrow: false,
	isMedium: true,
	isWide: false,
	contentWidth: DEFAULT_WIDTH - HORIZONTAL_PADDING,
});

function getBreakpoint(width: number): TerminalBreakpoint {
	if (width <= NARROW_MAX_WIDTH) {
		return "narrow";
	}

	if (width <= MEDIUM_MAX_WIDTH) {
		return "medium";
	}

	return "wide";
}

interface ResponsiveLayoutProps {
	header: React.ReactNode;
	content: React.ReactNode;
	footer: React.ReactNode;
	children?: React.ReactNode;
	headerHeight?: number;
	footerHeight?: number;
	minContentHeight?: number;
}

export function ResponsiveLayout({
	header,
	content,
	footer,
	headerHeight = 10,
	footerHeight = 6,
	minContentHeight = 4,
}: ResponsiveLayoutProps): React.ReactElement {
	const { stdout } = useStdout();
	const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
		width: stdout.columns ?? DEFAULT_WIDTH,
		height: stdout.rows ?? DEFAULT_HEIGHT,
	}));

	useEffect(() => {
		const handleResize = () => {
			setDimensions({
				width: stdout.columns ?? DEFAULT_WIDTH,
				height: stdout.rows ?? DEFAULT_HEIGHT,
			});
		};

		stdout.on("resize", handleResize);

		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	const breakpoint = getBreakpoint(dimensions.width);
	const isNarrow = breakpoint === "narrow";
	const isMedium = breakpoint === "medium";
	const isWide = breakpoint === "wide";

	const effectiveHeaderHeight = isNarrow ? Math.min(headerHeight, 4) : headerHeight;
	const calculatedContentHeight = Math.max(
		minContentHeight,
		dimensions.height - effectiveHeaderHeight - footerHeight,
	);

	const contextValue: ResponsiveContextValue = {
		width: dimensions.width,
		height: dimensions.height,
		breakpoint,
		isNarrow,
		isMedium,
		isWide,
		contentWidth: dimensions.width - HORIZONTAL_PADDING,
	};

	return (
		<ResponsiveContext.Provider value={contextValue}>
			<Box flexDirection="column" height={dimensions.height}>
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
		</ResponsiveContext.Provider>
	);
}

export function useResponsive(): ResponsiveContextValue {
	return useContext(ResponsiveContext);
}
