import { useStdout } from "ink";
import { useEffect, useState } from "react";

export interface TerminalDimensions {
  width: number;
  height: number;
}

export type TerminalBreakpoint = "narrow" | "medium" | "wide";

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 24;

const NARROW_MAX_WIDTH = 60;
const MEDIUM_MAX_WIDTH = 100;

function getTerminalDimensions(stdout: NodeJS.WriteStream): TerminalDimensions {
  return {
    height: stdout.rows ?? DEFAULT_HEIGHT,
    width: stdout.columns ?? DEFAULT_WIDTH,
  };
}

function getBreakpoint(width: number): TerminalBreakpoint {
  if (width <= NARROW_MAX_WIDTH) {
    return "narrow";
  }

  if (width <= MEDIUM_MAX_WIDTH) {
    return "medium";
  }

  return "wide";
}

export interface UseTerminalDimensionsResult {
  width: number;
  height: number;
  breakpoint: TerminalBreakpoint;
  isNarrow: boolean;
  isMedium: boolean;
  isWide: boolean;
}

export function useTerminalDimensions(): UseTerminalDimensionsResult {
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

  const breakpoint = getBreakpoint(dimensions.width);

  return {
    breakpoint,
    height: dimensions.height,
    isMedium: breakpoint === "medium",
    isNarrow: breakpoint === "narrow",
    isWide: breakpoint === "wide",
    width: dimensions.width,
  };
}
