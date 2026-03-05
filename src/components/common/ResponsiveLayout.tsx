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
  breakpoint: "medium",
  contentWidth: DEFAULT_WIDTH - HORIZONTAL_PADDING,
  height: DEFAULT_HEIGHT,
  isMedium: true,
  isNarrow: false,
  isWide: false,
  width: DEFAULT_WIDTH,
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
    height: stdout.rows ?? DEFAULT_HEIGHT,
    width: stdout.columns ?? DEFAULT_WIDTH,
  }));

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        height: stdout.rows ?? DEFAULT_HEIGHT,
        width: stdout.columns ?? DEFAULT_WIDTH,
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
    breakpoint,
    contentWidth: dimensions.width - HORIZONTAL_PADDING,
    height: dimensions.height,
    isMedium,
    isNarrow,
    isWide,
    width: dimensions.width,
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
