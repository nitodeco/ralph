const TERMINAL_RESTORE_SEQUENCE = "\x1b[<u\x1b[?2004l\x1b[?2026l\x1b[?25h";

export interface TerminalInput {
  readonly isTTY?: boolean;
  setRawMode?: (isRawModeEnabled: boolean) => unknown;
  pause?: () => unknown;
  unref?: () => unknown;
}

export interface TerminalOutput {
  readonly isTTY?: boolean;
  write: (text: string) => unknown;
}

function runBestEffort(operation: () => unknown): void {
  try {
    operation();
  } catch {
    return;
  }
}

export function restoreTerminalInput(
  input: TerminalInput = process.stdin,
  output: TerminalOutput = process.stdout,
): void {
  if (input.isTTY) {
    if (input.setRawMode) {
      runBestEffort(() => input.setRawMode?.(false));
    }

    if (input.pause) {
      runBestEffort(() => input.pause?.());
    }

    if (input.unref) {
      runBestEffort(() => input.unref?.());
    }
  }

  if (output.isTTY) {
    runBestEffort(() => output.write(TERMINAL_RESTORE_SEQUENCE));
  }
}
