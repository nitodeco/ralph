import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runAgentWithPrompt } from "@/lib/agent.ts";

interface MockSpawnProcess {
  stdout: ReadableStream<Uint8Array>;
  kill: (signal?: string) => void;
  exited: Promise<number | null>;
}

interface MockProcessController {
  process: MockSpawnProcess;
  killSignals: string[];
}

function createStdoutStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunkText of chunks) {
        controller.enqueue(encoder.encode(chunkText));
      }

      controller.close();
    },
  });
}

function createMockProcess(options: {
  chunks: string[];
  resolveOnSignal?: string;
}): MockProcessController {
  const killSignals: string[] = [];

  let resolveExit: (exitCode: number | null) => void = () => {};

  const exited = new Promise<number | null>((resolvePromise) => {
    resolveExit = resolvePromise;
  });

  const process: MockSpawnProcess = {
    exited,
    kill: (signal = "SIGTERM") => {
      killSignals.push(signal);

      if (options.resolveOnSignal && signal === options.resolveOnSignal) {
        resolveExit(signal === "SIGKILL" ? 137 : 0);
      }
    },
    stdout: createStdoutStream(options.chunks),
  };

  return { killSignals, process };
}

describe("runAgentWithPrompt", () => {
  const originalSpawn = Bun.spawn;

  beforeEach(() => {
    (Bun as { spawn: typeof Bun.spawn }).spawn = originalSpawn;
  });

  afterEach(() => {
    (Bun as { spawn: typeof Bun.spawn }).spawn = originalSpawn;
  });

  test("parses newline-delimited output and trailing buffered line", async () => {
    const mockController = createMockProcess({
      chunks: [
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hello"}]}}\n',
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":" World"}]}}',
      ],
      resolveOnSignal: undefined,
    });

    mockController.process.exited = Promise.resolve(0);
    (Bun as { spawn: typeof Bun.spawn }).spawn = () => mockController.process as never;

    const outputChunks: string[] = [];
    const runResult = runAgentWithPrompt({
      agentType: "cursor",
      onOutput: (outputChunk) => outputChunks.push(outputChunk),
      prompt: "Test prompt",
    });

    const output = await runResult.promise;

    expect(output).toBe("Hello World");
    expect(outputChunks).toEqual(["Hello", " World"]);
  });

  test("aborts with cancellation error after SIGKILL fallback", async () => {
    const mockController = createMockProcess({
      chunks: [],
      resolveOnSignal: "SIGKILL",
    });

    (Bun as { spawn: typeof Bun.spawn }).spawn = () => mockController.process as never;

    const runResult = runAgentWithPrompt({
      agentType: "cursor",
      prompt: "Test prompt",
    });

    runResult.abort();

    await expect(runResult.promise).rejects.toThrow("Agent generation was cancelled");
    expect(mockController.killSignals).toContain("SIGTERM");
    expect(mockController.killSignals).toContain("SIGKILL");
  });
});
