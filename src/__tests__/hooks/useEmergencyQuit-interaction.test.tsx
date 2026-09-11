import { describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import { useEmergencyQuit } from "@/hooks/useEmergencyQuit.ts";

function EmergencyQuitHarness({ onQuit }: { readonly onQuit: () => void }): null {
  useEmergencyQuit(onQuit);

  return null;
}

function getInteractiveStreams(): {
  readonly errorOutput: NodeJS.WriteStream;
  readonly input: NodeJS.ReadStream;
  readonly inputStream: PassThrough;
  readonly output: NodeJS.WriteStream;
} {
  const inputStream = new PassThrough();
  const outputStream = new PassThrough();
  const errorOutputStream = new PassThrough();

  Object.defineProperties(inputStream, {
    isTTY: { value: true },
    ref: { value: mock(() => inputStream) },
    setRawMode: { value: mock(() => inputStream) },
    unref: { value: mock(() => inputStream) },
  });
  Object.defineProperties(outputStream, {
    columns: { value: 80 },
    isTTY: { value: true },
    rows: { value: 24 },
  });

  return {
    errorOutput: errorOutputStream as unknown as NodeJS.WriteStream,
    input: inputStream as unknown as NodeJS.ReadStream,
    inputStream,
    output: outputStream as unknown as NodeJS.WriteStream,
  };
}

describe("useEmergencyQuit interaction", () => {
  test("requests quit after two distinct Escape presses", async () => {
    const onQuit = mock(() => undefined);
    const { errorOutput, input, inputStream, output } = getInteractiveStreams();
    const inkInstance = render(<EmergencyQuitHarness onQuit={onQuit} />, {
      interactive: true,
      stderr: errorOutput,
      stdin: input,
      stdout: output,
    });

    await Bun.sleep(20);
    inputStream.write("\x1b");
    await Bun.sleep(40);
    inputStream.write("\x1b");
    await Bun.sleep(40);

    expect(onQuit).toHaveBeenCalledTimes(1);

    inkInstance.unmount();
    await inkInstance.waitUntilExit();
  });

  test("routes Ctrl+C through the clean quit callback", async () => {
    const onQuit = mock(() => undefined);
    const { errorOutput, input, inputStream, output } = getInteractiveStreams();
    const inkInstance = render(<EmergencyQuitHarness onQuit={onQuit} />, {
      exitOnCtrlC: false,
      interactive: true,
      stderr: errorOutput,
      stdin: input,
      stdout: output,
    });

    await Bun.sleep(20);
    inputStream.write("\x03");
    await Bun.sleep(20);

    expect(onQuit).toHaveBeenCalledTimes(1);

    inkInstance.unmount();
    await inkInstance.waitUntilExit();
  });
});
