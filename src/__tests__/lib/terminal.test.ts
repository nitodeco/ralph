import { describe, expect, mock, test } from "bun:test";
import { restoreTerminalInput } from "@/lib/terminal.ts";

describe("restoreTerminalInput", () => {
  test("restores terminal input and output modes", () => {
    const setRawMode = mock(() => undefined);
    const pause = mock(() => undefined);
    const unref = mock(() => undefined);
    const write = mock(() => true);

    restoreTerminalInput({ isTTY: true, pause, setRawMode, unref }, { isTTY: true, write });

    expect(setRawMode).toHaveBeenCalledWith(false);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("\x1b[<u\x1b[?2004l\x1b[?2026l\x1b[?25h");
  });

  test("continues restoring modes when an operation throws", () => {
    const pause = mock(() => undefined);
    const write = mock(() => true);

    restoreTerminalInput(
      {
        isTTY: true,
        pause,
        setRawMode: () => {
          throw new Error("raw mode unavailable");
        },
      },
      { isTTY: true, write },
    );

    expect(pause).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("does nothing for non-TTY streams", () => {
    const setRawMode = mock(() => undefined);
    const write = mock(() => true);

    restoreTerminalInput({ isTTY: false, setRawMode }, { isTTY: false, write });

    expect(setRawMode).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
