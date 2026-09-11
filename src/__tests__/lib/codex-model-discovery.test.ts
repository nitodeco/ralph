import { describe, expect, test } from "bun:test";
import {
  discoverCodexModels,
  type CodexAppServerSession,
} from "@/lib/services/codex-model-discovery.ts";

function createSession(
  messages: unknown[],
  sentMessages: unknown[],
  closeCalls: string[],
): CodexAppServerSession {
  return {
    close: () => {
      closeCalls.push("closed");
    },
    messages: (async function* () {
      for (const message of messages) {
        yield message;
      }
    })(),
    send: (message) => {
      sentMessages.push(message);
    },
  };
}

describe("discoverCodexModels", () => {
  test("initializes app-server and returns visible account models", async () => {
    const sentMessages: unknown[] = [];
    const closeCalls: string[] = [];
    const models = await discoverCodexModels({
      sessionFactory: () =>
        createSession(
          [
            { method: "server/notification", params: {} },
            { id: 1, result: { userAgent: "Codex" } },
            {
              id: 2,
              result: {
                data: [{ model: "gpt-6-astra" }, { model: "gpt-5.6-sol" }],
                nextCursor: null,
              },
            },
          ],
          sentMessages,
          closeCalls,
        ),
    });

    expect(models).toEqual(["gpt-6-astra", "gpt-5.6-sol"]);
    expect(sentMessages).toHaveLength(3);
    expect(sentMessages.at(0)).toMatchObject({ id: 1, method: "initialize" });
    expect(sentMessages.at(1)).toEqual({ method: "initialized" });
    expect(sentMessages.at(2)).toMatchObject({ id: 2, method: "model/list" });
    expect(closeCalls).toEqual(["closed"]);
  });

  test("loads every model-list page and removes duplicate models", async () => {
    const sentMessages: unknown[] = [];
    const models = await discoverCodexModels({
      sessionFactory: () =>
        createSession(
          [
            { id: 1, result: { userAgent: "Codex" } },
            {
              id: 2,
              result: { data: [{ model: "gpt-6-astra" }], nextCursor: "page-2" },
            },
            {
              id: 3,
              result: {
                data: [{ model: "gpt-6-astra" }, { model: "gpt-5.6-sol" }],
                nextCursor: null,
              },
            },
          ],
          sentMessages,
          [],
        ),
    });

    expect(models).toEqual(["gpt-6-astra", "gpt-5.6-sol"]);
    expect(sentMessages.at(3)).toMatchObject({
      id: 3,
      method: "model/list",
      params: { cursor: "page-2" },
    });
  });

  test("rejects malformed model-list responses and closes the session", async () => {
    const closeCalls: string[] = [];

    await expect(
      discoverCodexModels({
        sessionFactory: () =>
          createSession(
            [
              { id: 1, result: { userAgent: "Codex" } },
              { id: 2, result: { data: "invalid" } },
            ],
            [],
            closeCalls,
          ),
      }),
    ).rejects.toThrow("invalid model list");
    expect(closeCalls).toEqual(["closed"]);
  });
});
