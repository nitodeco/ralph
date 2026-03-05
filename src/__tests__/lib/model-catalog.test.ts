import { afterEach, describe, expect, test } from "bun:test";
import { clearModelCatalogCache, getModelsForAgent } from "@/lib/services/index.ts";

describe("getModelsForAgent", () => {
  afterEach(() => {
    clearModelCatalogCache();
  });

  test("returns models from JSON output for cursor", async () => {
    const result = await getModelsForAgent("cursor", {
      commandExecutor: async (commandArguments) => ({
        commandArguments,
        exitCode: 0,
        stdout: JSON.stringify({ models: ["gpt-5-codex", "gpt-5.1"] }),
        stderr: "",
      }),
      forceRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.catalog?.models).toEqual(["gpt-5-codex", "gpt-5.1"]);
    expect(result.catalog?.source).toBe("live");
  });

  test("falls back to later commands when earlier command has no models", async () => {
    const commandCalls: string[] = [];
    const result = await getModelsForAgent("cursor", {
      commandExecutor: async (commandArguments) => {
        commandCalls.push(commandArguments.join(" "));

        if (commandCalls.length === 1) {
          return {
            commandArguments,
            exitCode: 1,
            stdout: "",
            stderr: "unknown command",
          };
        }

        return {
          commandArguments,
          exitCode: 0,
          stdout: "gpt-5-codex\n",
          stderr: "",
        };
      },
      forceRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.catalog?.models).toEqual(["gpt-5-codex"]);
    expect(commandCalls.length).toBeGreaterThanOrEqual(2);
  });

  test("returns helpful error when no commands yield models", async () => {
    const result = await getModelsForAgent("cursor", {
      commandExecutor: async (commandArguments) => ({
        commandArguments,
        exitCode: 1,
        stdout: "",
        stderr: "failed",
      }),
      forceRefresh: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unable to discover models for cursor");
    expect(result.error).toContain("agent models");
  });

  test("does not treat plain product names as model ids", async () => {
    const result = await getModelsForAgent("cursor", {
      commandExecutor: async (commandArguments) => ({
        commandArguments,
        exitCode: 0,
        stdout: "Codex\nModels\n",
        stderr: "",
      }),
      forceRefresh: true,
    });

    expect(result.success).toBe(false);
  });

  test("returns codex fallback model list without probing unsupported subcommands", async () => {
    const commandCalls: string[] = [];
    const result = await getModelsForAgent("codex", {
      commandExecutor: async (commandArguments) => {
        commandCalls.push(commandArguments.join(" "));

        return {
          commandArguments,
          exitCode: 1,
          stdout: "",
          stderr: "should not be called",
        };
      },
      forceRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.catalog?.source).toBe("fallback");
    expect(result.catalog?.models).toEqual(["gpt-5-codex"]);
    expect(commandCalls).toEqual([]);
  });

  test("returns claude fallback aliases without probing unsupported subcommands", async () => {
    const commandCalls: string[] = [];
    const result = await getModelsForAgent("claude", {
      commandExecutor: async (commandArguments) => {
        commandCalls.push(commandArguments.join(" "));

        return {
          commandArguments,
          exitCode: 1,
          stdout: "",
          stderr: "failed",
        };
      },
      forceRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.catalog?.source).toBe("fallback");
    expect(result.catalog?.models).toEqual(["sonnet", "opus"]);
    expect(commandCalls).toEqual([]);
  });

  test("parses clean model ids from noisy text output", async () => {
    const result = await getModelsForAgent("cursor", {
      commandExecutor: async (commandArguments) => ({
        commandArguments,
        exitCode: 0,
        stdout:
          "composer-1.5\ncomposer-1\ngpt-5.3-codex-fast\n4.6ude\n4.5s-4.5\ngpt-5.2-high\nsonnet-4.5\n",
        stderr: "",
      }),
      forceRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(result.catalog?.models).toEqual([
      "composer-1.5",
      "composer-1",
      "gpt-5.3-codex-fast",
      "gpt-5.2-high",
      "sonnet-4.5",
    ]);
  });
});
