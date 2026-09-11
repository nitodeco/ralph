import { describe, expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { render } from "ink";
import { useState } from "react";
import { TextInput } from "@/components/common/TextInput.tsx";

interface TextInputHarnessProps {
  readonly onValueChange: (value: string) => void;
}

function TextInputHarness({ onValueChange }: TextInputHarnessProps): React.ReactElement {
  const [value, setValue] = useState("");

  return (
    <TextInput
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onValueChange(nextValue);
      }}
    />
  );
}

describe("TextInput interaction", () => {
  test("retains all rapidly received input chunks", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const errorOutput = new PassThrough();
    const receivedValues: string[] = [];

    Object.defineProperties(input, {
      isTTY: { value: true },
      ref: { value: mock(() => input) },
      setRawMode: { value: mock(() => input) },
      unref: { value: mock(() => input) },
    });
    Object.defineProperties(output, {
      columns: { value: 80 },
      isTTY: { value: true },
      rows: { value: 24 },
    });

    const inkInstance = render(
      <TextInputHarness onValueChange={(value) => receivedValues.push(value)} />,
      {
        interactive: true,
        stderr: errorOutput as unknown as NodeJS.WriteStream,
        stdin: input as unknown as NodeJS.ReadStream,
        stdout: output as unknown as NodeJS.WriteStream,
      },
    );

    await Bun.sleep(20);

    for (const inputChunk of ["ral", "ph", " ", "input"]) {
      input.write(inputChunk);
    }

    await Bun.sleep(20);

    expect(receivedValues.at(-1)).toBe("ralph input");

    inkInstance.unmount();
    await inkInstance.waitUntilExit();
  });
});
