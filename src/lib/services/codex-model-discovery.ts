import packageJson from "../../../package.json";

const CODEX_APP_SERVER_TIMEOUT_MS = 8_000;
const INITIALIZE_REQUEST_ID = 1;
const FIRST_MODEL_LIST_REQUEST_ID = 2;
const MODEL_LIST_PAGE_SIZE = 100;

interface CodexAppServerSession {
  close: () => void;
  messages: AsyncIterable<unknown>;
  send: (message: unknown) => void;
}

interface CodexModelDiscoveryOptions {
  sessionFactory?: () => CodexAppServerSession;
}

interface CodexModelListPage {
  models: string[];
  nextCursor: string | null;
}

interface CodexAppServerExecutionState {
  bufferedOutput: string;
  isClosed: boolean;
  isTimedOut: boolean;
}

interface CodexModelDiscoveryState {
  isInitialized: boolean;
  modelListRequestId: number;
  models: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasResponseId(message: unknown, responseId: number): boolean {
  return isRecord(message) && message.id === responseId;
}

function assertSuccessfulResponse(message: unknown, responseId: number): void {
  if (!isRecord(message) || message.id !== responseId) {
    throw new Error(`Codex app-server returned an invalid response for request ${responseId}.`);
  }

  if (message.error !== undefined) {
    throw new Error(
      `Codex app-server request ${responseId} failed: ${JSON.stringify(message.error)}`,
    );
  }

  if (!isRecord(message.result)) {
    throw new Error(`Codex app-server returned no result for request ${responseId}.`);
  }
}

function parseModelListPage(message: unknown, responseId: number): CodexModelListPage {
  assertSuccessfulResponse(message, responseId);

  if (!isRecord(message) || !isRecord(message.result) || !Array.isArray(message.result.data)) {
    throw new Error("Codex app-server returned an invalid model list.");
  }

  const models = message.result.data.flatMap((modelValue) => {
    if (!isRecord(modelValue) || typeof modelValue.model !== "string") {
      return [];
    }

    return [modelValue.model];
  });
  const { nextCursor: maybeNextCursor } = message.result;

  if (
    maybeNextCursor !== undefined &&
    maybeNextCursor !== null &&
    typeof maybeNextCursor !== "string"
  ) {
    throw new Error("Codex app-server returned an invalid model-list cursor.");
  }

  return {
    models,
    nextCursor: maybeNextCursor ?? null,
  };
}

async function* readJsonLines(
  outputStream: ReadableStream<Uint8Array>,
  executionState: CodexAppServerExecutionState,
): AsyncGenerator<unknown> {
  const outputReader = outputStream.getReader();
  const outputDecoder = new TextDecoder();

  try {
    for (;;) {
      const { done: isDone, value: maybeOutputChunk } = await outputReader.read();
      const decodedOutput = outputDecoder.decode(maybeOutputChunk, { stream: !isDone });
      const outputLines = `${executionState.bufferedOutput}${decodedOutput}`.split("\n");
      const maybePartialLine = isDone ? undefined : outputLines.at(-1);
      const completeOutputLines = isDone ? outputLines : outputLines.slice(0, -1);

      executionState.bufferedOutput = maybePartialLine ?? "";

      for (const outputLine of completeOutputLines) {
        const trimmedOutputLine = outputLine.trim();

        if (!trimmedOutputLine) {
          continue;
        }

        try {
          yield JSON.parse(trimmedOutputLine);
        } catch {
          throw new Error("Codex app-server returned malformed JSON.");
        }
      }

      if (isDone) {
        return;
      }
    }
  } finally {
    outputReader.releaseLock();
  }
}

function createCodexAppServerSession(): CodexAppServerSession {
  const appServerProcess = Bun.spawn(["codex", "app-server"], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const executionState: CodexAppServerExecutionState = {
    bufferedOutput: "",
    isClosed: false,
    isTimedOut: false,
  };
  const stderrPromise = new Response(appServerProcess.stderr).text();
  const timeoutIdentifier = setTimeout(() => {
    executionState.isTimedOut = true;
    appServerProcess.kill();
  }, CODEX_APP_SERVER_TIMEOUT_MS);

  const close = () => {
    if (executionState.isClosed) {
      return;
    }

    executionState.isClosed = true;
    clearTimeout(timeoutIdentifier);
    appServerProcess.stdin.end();
    appServerProcess.kill();
  };

  const messages = (async function* (): AsyncGenerator<unknown> {
    yield* readJsonLines(appServerProcess.stdout, executionState);

    if (executionState.isTimedOut) {
      throw new Error("Codex app-server model discovery timed out.");
    }

    const stderr = (await stderrPromise).trim();

    throw new Error(stderr || "Codex app-server exited before returning its model catalog.");
  })();

  return {
    close,
    messages,
    send: (message) => {
      appServerProcess.stdin.write(`${JSON.stringify(message)}\n`);
    },
  };
}

function createInitializeRequest(): unknown {
  return {
    id: INITIALIZE_REQUEST_ID,
    method: "initialize",
    params: {
      clientInfo: {
        name: "ralph",
        version: packageJson.version,
      },
    },
  };
}

function createModelListRequest(requestId: number, maybeCursor: string | null): unknown {
  return {
    id: requestId,
    method: "model/list",
    params: {
      cursor: maybeCursor,
      includeHidden: false,
      limit: MODEL_LIST_PAGE_SIZE,
    },
  };
}

export async function discoverCodexModels(options?: CodexModelDiscoveryOptions): Promise<string[]> {
  const appServerSession = (options?.sessionFactory ?? createCodexAppServerSession)();
  const discoveryState: CodexModelDiscoveryState = {
    isInitialized: false,
    modelListRequestId: FIRST_MODEL_LIST_REQUEST_ID,
    models: [],
  };

  appServerSession.send(createInitializeRequest());

  try {
    for await (const message of appServerSession.messages) {
      if (!discoveryState.isInitialized) {
        if (!hasResponseId(message, INITIALIZE_REQUEST_ID)) {
          continue;
        }

        assertSuccessfulResponse(message, INITIALIZE_REQUEST_ID);
        discoveryState.isInitialized = true;
        appServerSession.send({ method: "initialized" });
        appServerSession.send(createModelListRequest(discoveryState.modelListRequestId, null));

        continue;
      }

      if (!hasResponseId(message, discoveryState.modelListRequestId)) {
        continue;
      }

      const modelListPage = parseModelListPage(message, discoveryState.modelListRequestId);
      discoveryState.models.push(...modelListPage.models);

      if (modelListPage.nextCursor) {
        discoveryState.modelListRequestId += 1;
        appServerSession.send(
          createModelListRequest(discoveryState.modelListRequestId, modelListPage.nextCursor),
        );

        continue;
      }

      return [...new Set(discoveryState.models)];
    }

    throw new Error("Codex app-server closed before returning its model catalog.");
  } finally {
    appServerSession.close();
  }
}

export type { CodexAppServerSession };
