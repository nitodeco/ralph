import { getConfigService } from "./container.ts";
import type { AgentType } from "./config/types.ts";

const MODEL_CATALOG_CACHE_TTL_MS = 60_000;
const MODEL_DISCOVERY_TIMEOUT_MS = 8_000;
const MODEL_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,78}[A-Za-z0-9]$/;
const ANSI_ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_ESCAPE_PATTERN = new RegExp(`${ANSI_ESCAPE_CHARACTER}\\[[0-9;]*m`, "g");
const EXCLUDED_MODEL_TOKENS = new Set([
  "model",
  "models",
  "name",
  "id",
  "default",
  "available",
  "preview",
  "cursor",
  "claude",
  "codex",
]);

interface CommandExecutionResult {
  commandArguments: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ModelDiscoveryOptions {
  forceRefresh?: boolean;
  commandExecutor?: (commandArguments: string[]) => Promise<CommandExecutionResult>;
}

export interface AgentModelCatalog {
  agent: AgentType;
  models: string[];
  source: "live" | "cache" | "fallback";
  fetchedAt: number;
}

export interface AgentModelCatalogResult {
  success: boolean;
  catalog?: AgentModelCatalog;
  error?: string;
}

interface CacheEntry {
  fetchedAt: number;
  models: string[];
}

const modelCatalogCache = new Map<AgentType, CacheEntry>();

const CURRENT_MODEL_CACHE_TTL_MS = 60_000;
const CURRENT_MODEL_PATTERN = /^Model\s*:\s*(.+)$/m;

interface CurrentModelCacheEntry {
  model: string;
  fetchedAt: number;
}

const currentModelCache = new Map<AgentType, CurrentModelCacheEntry>();

export function clearCurrentModelCache(): void {
  currentModelCache.clear();
}

export async function getCurrentModelFromAgent(agentType: AgentType): Promise<string | undefined> {
  if (agentType !== "cursor") {
    return undefined;
  }

  const now = Date.now();
  const cachedEntry = currentModelCache.get(agentType);

  if (cachedEntry && now - cachedEntry.fetchedAt <= CURRENT_MODEL_CACHE_TTL_MS) {
    return cachedEntry.model;
  }

  try {
    const commandResult = await executeCommand(["agent", "about"]);

    if (commandResult.exitCode !== 0) {
      return undefined;
    }

    const match = commandResult.stdout.match(CURRENT_MODEL_PATTERN);
    const model = match?.[1]?.trim();

    if (!model) {
      return undefined;
    }

    currentModelCache.set(agentType, { model, fetchedAt: now });

    return model;
  } catch {
    return undefined;
  }
}

const MODEL_DISCOVERY_COMMANDS: Record<AgentType, string[][]> = {
  cursor: [
    ["agent", "models", "--json"],
    ["agent", "models"],
    ["agent", "model", "list", "--json"],
    ["agent", "model", "list"],
  ],
  claude: [],
  codex: [],
};

const FALLBACK_MODELS_BY_AGENT: Partial<Record<AgentType, string[]>> = {
  claude: ["sonnet", "opus"],
  codex: ["gpt-5-codex"],
};

function normalizeModelIdentifier(modelIdentifier: string): string {
  return modelIdentifier.trim();
}

function isLikelyModelIdentifier(candidate: string): boolean {
  const normalizedCandidate = normalizeModelIdentifier(candidate);
  const loweredCandidate = normalizedCandidate.toLowerCase();

  if (!normalizedCandidate) {
    return false;
  }

  if (normalizedCandidate.startsWith("-")) {
    return false;
  }

  if (!MODEL_IDENTIFIER_PATTERN.test(normalizedCandidate)) {
    return false;
  }

  if (EXCLUDED_MODEL_TOKENS.has(loweredCandidate)) {
    return false;
  }

  const hasIdentifierSeparator = /[-_.:]/.test(normalizedCandidate);
  const hasDigit = /\d/.test(normalizedCandidate);

  return hasIdentifierSeparator || hasDigit;
}

function uniqueModels(modelCandidates: string[]): string[] {
  const seenModels = new Set<string>();
  const normalizedModels: string[] = [];

  for (const modelCandidate of modelCandidates) {
    const normalizedModel = normalizeModelIdentifier(modelCandidate);
    const loweredModel = normalizedModel.toLowerCase();

    if (!normalizedModel || seenModels.has(loweredModel)) {
      continue;
    }

    seenModels.add(loweredModel);
    normalizedModels.push(normalizedModel);
  }

  return normalizedModels;
}

function extractModelsFromJsonValue(parsedValue: unknown): string[] {
  if (typeof parsedValue === "string") {
    return isLikelyModelIdentifier(parsedValue) ? [parsedValue] : [];
  }

  if (Array.isArray(parsedValue)) {
    const arrayModels = parsedValue.flatMap((arrayItem) => extractModelsFromJsonValue(arrayItem));

    return uniqueModels(arrayModels);
  }

  if (parsedValue && typeof parsedValue === "object") {
    const objectValue = parsedValue as Record<string, unknown>;
    const directFields = ["model", "id", "name"]
      .flatMap((fieldName) => extractModelsFromJsonValue(objectValue[fieldName]))
      .filter((modelIdentifier) => isLikelyModelIdentifier(modelIdentifier));

    const nestedFields = ["models", "availableModels", "choices"].flatMap((fieldName) =>
      extractModelsFromJsonValue(objectValue[fieldName]),
    );

    return uniqueModels([...directFields, ...nestedFields]);
  }

  return [];
}

function extractModelsFromTextOutput(outputText: string): string[] {
  const modelCandidates: string[] = [];
  const outputLines = outputText.replaceAll(ANSI_ESCAPE_PATTERN, "").split("\n");

  for (const outputLine of outputLines) {
    const trimmedLine = outputLine.trim();

    if (!trimmedLine) {
      continue;
    }

    const lineWithoutBullet = trimmedLine.replace(/^\s*[-*•]\s*/, "");
    const tokenMatches =
      lineWithoutBullet.match(
        /(?<![A-Za-z0-9._:-])[A-Za-z][A-Za-z0-9._:-]{1,79}(?![A-Za-z0-9._:-])/g,
      ) ?? [];

    for (const tokenMatch of tokenMatches) {
      if (isLikelyModelIdentifier(tokenMatch)) {
        modelCandidates.push(tokenMatch);
      }
    }
  }

  return uniqueModels(modelCandidates);
}

function parseModelsFromOutput(outputText: string): string[] {
  const sanitizedOutput = outputText.replaceAll(ANSI_ESCAPE_PATTERN, "").trim();

  if (!sanitizedOutput) {
    return [];
  }

  const parsedModelsFromFullJson = (() => {
    try {
      const parsedOutput = JSON.parse(sanitizedOutput);

      return extractModelsFromJsonValue(parsedOutput);
    } catch {
      return [];
    }
  })();

  if (parsedModelsFromFullJson.length > 0) {
    return uniqueModels(parsedModelsFromFullJson);
  }

  const parsedModelsFromJsonLines = sanitizedOutput
    .split("\n")
    .flatMap((lineText) => {
      const trimmedLine = lineText.trim();

      if (!trimmedLine) {
        return [];
      }

      try {
        const parsedLine = JSON.parse(trimmedLine);

        return extractModelsFromJsonValue(parsedLine);
      } catch {
        return [];
      }
    })
    .filter((modelIdentifier) => isLikelyModelIdentifier(modelIdentifier));

  if (parsedModelsFromJsonLines.length > 0) {
    return uniqueModels(parsedModelsFromJsonLines);
  }

  return extractModelsFromTextOutput(sanitizedOutput);
}

async function executeCommand(commandArguments: string[]): Promise<CommandExecutionResult> {
  const spawnedProcess = Bun.spawn(commandArguments, {
    stdin: null,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeoutIdentifier = setTimeout(() => {
    try {
      spawnedProcess.kill();
    } catch {
      // Process may already be terminated.
    }
  }, MODEL_DISCOVERY_TIMEOUT_MS);

  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(spawnedProcess.stdout).text(),
      new Response(spawnedProcess.stderr).text(),
      spawnedProcess.exited,
    ]);

    return { commandArguments, exitCode, stdout, stderr };
  } finally {
    clearTimeout(timeoutIdentifier);
  }
}

export function clearModelCatalogCache(): void {
  modelCatalogCache.clear();
}

export function getCachedModelsForAgent(agentType: AgentType): string[] {
  const cacheEntry = modelCatalogCache.get(agentType);

  if (!cacheEntry) {
    return [];
  }

  const now = Date.now();

  if (now - cacheEntry.fetchedAt > MODEL_CATALOG_CACHE_TTL_MS) {
    modelCatalogCache.delete(agentType);

    return [];
  }

  return cacheEntry.models;
}

export async function getModelsForAgent(
  agentType: AgentType,
  options?: ModelDiscoveryOptions,
): Promise<AgentModelCatalogResult> {
  const now = Date.now();
  const cacheEntry = modelCatalogCache.get(agentType);

  if (
    !options?.forceRefresh &&
    cacheEntry &&
    now - cacheEntry.fetchedAt <= MODEL_CATALOG_CACHE_TTL_MS
  ) {
    return {
      success: true,
      catalog: {
        agent: agentType,
        models: cacheEntry.models,
        source: "cache",
        fetchedAt: cacheEntry.fetchedAt,
      },
    };
  }

  const commandCandidates = MODEL_DISCOVERY_COMMANDS[agentType];
  const commandExecutor = options?.commandExecutor ?? executeCommand;
  const attemptedCommands: string[] = [];
  const commandErrors: string[] = [];

  for (const commandArguments of commandCandidates) {
    attemptedCommands.push(commandArguments.join(" "));

    try {
      const commandResult = await commandExecutor(commandArguments);
      const parsedModels = parseModelsFromOutput(commandResult.stdout);

      if (parsedModels.length > 0) {
        const uniqueParsedModels = uniqueModels(parsedModels);

        modelCatalogCache.set(agentType, {
          fetchedAt: now,
          models: uniqueParsedModels,
        });

        return {
          success: true,
          catalog: {
            agent: agentType,
            models: uniqueParsedModels,
            source: "live",
            fetchedAt: now,
          },
        };
      }

      const commandErrorText = commandResult.stderr.trim();

      if (commandErrorText) {
        commandErrors.push(`${commandArguments.join(" ")}: ${commandErrorText}`);
      }
    } catch (error) {
      commandErrors.push(
        `${commandArguments.join(" ")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const fallbackModels = FALLBACK_MODELS_BY_AGENT[agentType];

  if (fallbackModels && fallbackModels.length > 0) {
    const uniqueFallbackModels = uniqueModels(fallbackModels);

    modelCatalogCache.set(agentType, {
      fetchedAt: now,
      models: uniqueFallbackModels,
    });

    return {
      success: true,
      catalog: {
        agent: agentType,
        models: uniqueFallbackModels,
        source: "fallback",
        fetchedAt: now,
      },
    };
  }

  return {
    success: false,
    error: `Unable to discover models for ${agentType}. Tried: ${attemptedCommands.join(" | ")}${commandErrors.length > 0 ? `\n${commandErrors.join("\n")}` : ""}`,
  };
}

export async function getModelsForCurrentAgent(
  options?: ModelDiscoveryOptions,
): Promise<AgentModelCatalogResult> {
  const config = getConfigService().get();

  return getModelsForAgent(config.agent, options);
}
