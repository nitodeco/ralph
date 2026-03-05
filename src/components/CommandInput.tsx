import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { addCommandToHistory, getCommandHistoryList } from "@/lib/command-history.ts";
import {
  getCachedModelsForAgent,
  getConfigService,
  getModelsForAgent,
} from "@/lib/services/index.ts";
import { type PastedTextSegment, TextInput, expandPastedSegments } from "./common/TextInput.tsx";

export type TaskSubcommand = "done" | "undone" | "current" | "list";
export type SessionSubcommand =
  | "start"
  | "stop"
  | "resume"
  | "pause"
  | "clear"
  | "refresh"
  | "archive";

export type SlashCommand =
  | "init"
  | "setup"
  | "update"
  | "help"
  | "quit"
  | "exit"
  | "q"
  | "e"
  | "add"
  | "session"
  | "next"
  | "status"
  | "guardrail"
  | "guardrails"
  | "analyze"
  | "learn"
  | "note"
  | "memory"
  | "dismiss-update"
  | "agent"
  | "task"
  | "tasks"
  | "projects"
  | "migrate"
  | "plan"
  | "usage"
  | "config"
  | "auth"
  | "github"
  | "model";

export interface CommandArgs {
  iterations?: number;
  full?: boolean;
  taskIdentifier?: string;
  guardrailInstruction?: string;
  lesson?: string;
  note?: string;
  modelIdentifier?: string;
  taskSubcommand?: TaskSubcommand;
  sessionSubcommand?: SessionSubcommand;
}

interface CommandHint {
  description: string;
  args?: string;
}

const COMMAND_HINTS: Record<SlashCommand, CommandHint> = {
  add: { description: "Add a new task to the PRD" },
  agent: { description: "Switch coding agent" },
  analyze: { description: "View failure pattern analysis" },
  auth: { description: "Authenticate with GitHub via OAuth" },
  config: { description: "View configuration settings" },
  "dismiss-update": { description: "Dismiss the update notification" },
  e: { description: "Exit the application (alias for /exit)" },
  exit: { description: "Exit the application" },
  github: { description: "Configure GitHub integration" },
  guardrail: { args: "<text>", description: "Add a new guardrail instruction" },
  guardrails: { description: "View and manage guardrails" },
  help: { description: "Show help message" },
  init: { description: "Initialize a new PRD project" },
  learn: { args: "<lesson>", description: "Add a lesson to session memory" },
  memory: { description: "View and manage session memory" },
  model: { args: "[model-id]", description: "Switch agent model" },
  migrate: { description: "Migrate project data" },
  next: { args: "[n|title]", description: "Set the next task to work on" },
  note: { args: "<note>", description: "Add a note about the current task" },
  plan: { description: "View the current plan" },
  projects: { description: "Manage projects" },
  q: { description: "Exit the application (alias for /quit)" },
  quit: { description: "Exit the application" },
  session: {
    args: "<start|stop|resume|pause|clear|refresh|archive> [n|full]",
    description: "Session control",
  },
  setup: { description: "Configure global preferences" },
  status: { description: "Show session and project status" },
  task: { args: "<done|undone|current|list> [id]", description: "Manage tasks" },
  tasks: { description: "Open the tasks view" },
  update: { description: "Check for updates" },
  usage: { description: "View usage statistics" },
};

const VALID_COMMANDS = Object.keys(COMMAND_HINTS) as SlashCommand[];
const VALID_TASK_SUBCOMMANDS: TaskSubcommand[] = ["done", "undone", "current", "list"];
const VALID_SESSION_SUBCOMMANDS: SessionSubcommand[] = [
  "start",
  "stop",
  "resume",
  "pause",
  "clear",
  "refresh",
  "archive",
];
const RUNNING_COMMANDS: SlashCommand[] = ["session", "quit", "exit", "q", "e", "help", "status"];

interface AutocompleteResult {
  type: "suggestions" | "argument-hint" | "default" | "model-suggestions";
  suggestions?: { command: SlashCommand; hint: CommandHint }[];
  modelSuggestions?: string[];
  argumentHint?: string;
  commonPrefix?: string;
}

export function getCommonPrefix(commands: readonly string[]): string {
  if (commands.length === 0) {
    return "";
  }

  if (commands.length === 1) {
    return commands.at(0) ?? "";
  }

  const [firstCommand, ...restCommands] = commands;

  if (!firstCommand) {
    return "";
  }

  let prefix = firstCommand;

  for (const command of restCommands) {
    while (prefix.length > 0 && !command.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }

    if (prefix.length === 0) {
      break;
    }
  }

  return prefix;
}

export function getAutocompleteHint(
  input: string,
  isRunning: boolean,
  availableModels: string[] = [],
): AutocompleteResult {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { type: "default" };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const [partialCommand, ...restParts] = parts;

  if (partialCommand === undefined) {
    return { type: "default" };
  }

  const commandLower = partialCommand.toLowerCase();
  const availableCommands = isRunning ? RUNNING_COMMANDS : VALID_COMMANDS;
  const exactMatch = availableCommands.find((cmd) => cmd === commandLower);

  if (exactMatch) {
    const hint = COMMAND_HINTS[exactMatch];
    const hasEnteredArgs = restParts.length > 0 || trimmed.endsWith(" ");

    if (exactMatch === "model" && !isRunning) {
      const modelQuery = restParts.join(" ").toLowerCase();
      const matchingModels = availableModels.filter((modelIdentifier) =>
        modelIdentifier.toLowerCase().startsWith(modelQuery),
      );
      const hasStartedModelQuery = restParts.length > 0 || trimmed.endsWith(" ");

      if (matchingModels.length > 0 && hasStartedModelQuery) {
        return {
          commonPrefix: getCommonPrefix(
            matchingModels.map((modelIdentifier) => modelIdentifier.toLowerCase()),
          ),
          modelSuggestions: matchingModels,
          type: "model-suggestions",
        };
      }
    }

    if (hint.args && !hasEnteredArgs) {
      return {
        argumentHint: `/${exactMatch} ${hint.args} — ${hint.description}`,
        type: "argument-hint",
      };
    }

    return { type: "default" };
  }

  const matchingCommands = availableCommands
    .filter((cmd) => cmd.startsWith(commandLower))
    .map((cmd) => ({ command: cmd, hint: COMMAND_HINTS[cmd] }));

  if (matchingCommands.length > 0) {
    const commandNames = matchingCommands.map(({ command }) => command);
    const commonPrefix = getCommonPrefix(commandNames);

    return { commonPrefix, suggestions: matchingCommands, type: "suggestions" };
  }

  return { type: "default" };
}

interface CommandInputProps {
  onCommand: (command: SlashCommand, args?: CommandArgs) => void;
  isRunning?: boolean;
  helpMode?: boolean;
  pendingCommand?: string | null;
  onPendingCommandConsumed?: () => void;
}

interface ParsedCommand {
  command: SlashCommand;
  args?: CommandArgs;
}

function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const [firstPart, secondPart] = parts;

  if (!firstPart) {
    return null;
  }

  const commandName = firstPart.toLowerCase() as SlashCommand;

  if (!VALID_COMMANDS.includes(commandName)) {
    return null;
  }

  if (commandName === "session") {
    const subcommand = secondPart?.toLowerCase() as SessionSubcommand | undefined;

    if (!subcommand || !VALID_SESSION_SUBCOMMANDS.includes(subcommand)) {
      return null;
    }

    if (subcommand === "start") {
      const [, , thirdPart] = parts;

      if (thirdPart) {
        if (thirdPart.toLowerCase() === "full") {
          return { args: { full: true, sessionSubcommand: subcommand }, command: commandName };
        }

        const iterations = Number.parseInt(thirdPart, 10);

        if (!Number.isNaN(iterations) && iterations > 0) {
          return { args: { iterations, sessionSubcommand: subcommand }, command: commandName };
        }
      }
    }

    return { args: { sessionSubcommand: subcommand }, command: commandName };
  }

  if (commandName === "next" && parts.length > 1) {
    const taskIdentifier = parts.slice(1).join(" ");

    return { args: { taskIdentifier }, command: commandName };
  }

  if (commandName === "guardrail" && parts.length > 1) {
    const guardrailInstruction = parts.slice(1).join(" ");

    return { args: { guardrailInstruction }, command: commandName };
  }

  if (commandName === "learn" && parts.length > 1) {
    const lesson = parts.slice(1).join(" ");

    return { args: { lesson }, command: commandName };
  }

  if (commandName === "note" && parts.length > 1) {
    const note = parts.slice(1).join(" ");

    return { args: { note }, command: commandName };
  }

  if (commandName === "model" && parts.length > 1) {
    const modelIdentifier = parts.slice(1).join(" ");

    return { args: { modelIdentifier }, command: commandName };
  }

  if (commandName === "task") {
    const subcommand = secondPart?.toLowerCase() as TaskSubcommand | undefined;

    if (!subcommand || !VALID_TASK_SUBCOMMANDS.includes(subcommand)) {
      return null;
    }

    if (subcommand === "done" || subcommand === "undone") {
      const taskIdentifier = parts.slice(2).join(" ");

      return { args: { taskIdentifier, taskSubcommand: subcommand }, command: commandName };
    }

    return { args: { taskSubcommand: subcommand }, command: commandName };
  }

  return { command: commandName };
}

export function CommandInput({
  onCommand,
  isRunning = false,
  helpMode = false,
  pendingCommand = null,
  onPendingCommandConsumed,
}: CommandInputProps): React.ReactElement {
  const [inputValue, setInputValue] = useState("");
  const [pastedSegments, setPastedSegments] = useState<PastedTextSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedHintIndex, setSelectedHintIndex] = useState(0);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [savedInputValue, setSavedInputValue] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isModelLoading, setIsModelLoading] = useState(false);

  useEffect(() => {
    setCommandHistory(getCommandHistoryList());
  }, []);

  useEffect(() => {
    if (pendingCommand) {
      setInputValue(pendingCommand);
      setSelectedHintIndex(0);
      onPendingCommandConsumed?.();
    }
  }, [pendingCommand, onPendingCommandConsumed]);

  useEffect(() => {
    const trimmedInput = inputValue.trim().toLowerCase();
    const currentAgent = getConfigService().get().agent;

    if (isRunning || !trimmedInput.startsWith("/model")) {
      return;
    }

    const cachedModels = getCachedModelsForAgent(currentAgent);

    if (cachedModels.length > 0) {
      setAvailableModels(cachedModels);
    }

    let isCancelled = false;

    const loadModels = async () => {
      setIsModelLoading(true);
      const modelCatalogResult = await getModelsForAgent(currentAgent);

      if (isCancelled) {
        return;
      }

      if (modelCatalogResult.success && modelCatalogResult.catalog) {
        setAvailableModels(modelCatalogResult.catalog.models);
      }

      setIsModelLoading(false);
    };

    void loadModels();

    return () => {
      isCancelled = true;
    };
  }, [inputValue, isRunning]);

  const isNavigatingHistory = historyIndex !== null;
  const autocomplete = getAutocompleteHint(inputValue, isRunning, availableModels);
  const commandSuggestions =
    autocomplete.type === "suggestions" ? (autocomplete.suggestions ?? []) : [];
  const modelSuggestions =
    autocomplete.type === "model-suggestions" ? (autocomplete.modelSuggestions ?? []) : [];
  const hasCommandSuggestions = commandSuggestions.length > 0;
  const hasModelSuggestions = modelSuggestions.length > 0;
  const hasSuggestions = hasCommandSuggestions || hasModelSuggestions;

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setSelectedHintIndex(0);

    if (isNavigatingHistory) {
      setHistoryIndex(null);
      setSavedInputValue("");
    }
  };

  const handlePaste = (segment: PastedTextSegment) => {
    setPastedSegments((prev) => [...prev, segment]);
  };

  const getCompletedValue = (command: SlashCommand): string => {
    const hint = COMMAND_HINTS[command];
    const hasArgs = hint.args !== undefined;

    return hasArgs ? `/${command} ` : `/${command}`;
  };

  const getCurrentPartialCommand = (): string => {
    const trimmed = inputValue.trim();

    if (!trimmed.startsWith("/")) {
      return "";
    }

    const parts = trimmed.slice(1).split(/\s+/);

    return parts.at(0)?.toLowerCase() ?? "";
  };

  const getCurrentModelPartial = (): string => {
    const trimmed = inputValue.trim();

    if (!trimmed.startsWith("/model")) {
      return "";
    }

    const parts = trimmed.slice(1).split(/\s+/);

    if (parts.length <= 1) {
      return "";
    }

    return parts.slice(1).join(" ").toLowerCase();
  };

  const handleTabComplete = (direction: "forward" | "backward") => {
    if (hasModelSuggestions) {
      const currentModelPartial = getCurrentModelPartial();
      const commonPrefix = autocomplete.commonPrefix ?? "";
      const isCommonPrefixComplete = currentModelPartial === commonPrefix.toLowerCase();

      if (modelSuggestions.length === 1) {
        const [selectedModel] = modelSuggestions;

        if (selectedModel) {
          setInputValue(`/model ${selectedModel}`);
          setSelectedHintIndex(0);
        }

        return;
      }

      if (!isCommonPrefixComplete && commonPrefix.length > currentModelPartial.length) {
        setInputValue(`/model ${commonPrefix}`);

        return;
      }

      if (direction === "forward") {
        const nextIndex =
          selectedHintIndex >= modelSuggestions.length - 1 ? 0 : selectedHintIndex + 1;
        const selectedModel = modelSuggestions[nextIndex];

        if (selectedModel) {
          setInputValue(`/model ${selectedModel}`);
          setSelectedHintIndex(nextIndex);
        }
      } else {
        const previousIndex =
          selectedHintIndex <= 0 ? modelSuggestions.length - 1 : selectedHintIndex - 1;
        const selectedModel = modelSuggestions[previousIndex];

        if (selectedModel) {
          setInputValue(`/model ${selectedModel}`);
          setSelectedHintIndex(previousIndex);
        }
      }

      return;
    }

    if (!hasCommandSuggestions) {
      return;
    }

    const currentPartial = getCurrentPartialCommand();
    const commonPrefix = autocomplete.commonPrefix ?? "";
    const isCommonPrefixComplete = currentPartial === commonPrefix.toLowerCase();

    if (commandSuggestions.length === 1) {
      const [selectedSuggestion] = commandSuggestions;

      if (selectedSuggestion) {
        setInputValue(getCompletedValue(selectedSuggestion.command));
        setSelectedHintIndex(0);
      }

      return;
    }

    if (!isCommonPrefixComplete && commonPrefix.length > currentPartial.length) {
      setInputValue(`/${commonPrefix}`);

      return;
    }

    if (direction === "forward") {
      const nextIndex =
        selectedHintIndex >= commandSuggestions.length - 1 ? 0 : selectedHintIndex + 1;
      const selectedSuggestion = commandSuggestions[nextIndex];

      if (selectedSuggestion) {
        setInputValue(getCompletedValue(selectedSuggestion.command));
        setSelectedHintIndex(nextIndex);
      }
    } else {
      const previousIndex =
        selectedHintIndex <= 0 ? commandSuggestions.length - 1 : selectedHintIndex - 1;
      const selectedSuggestion = commandSuggestions[previousIndex];

      if (selectedSuggestion) {
        setInputValue(getCompletedValue(selectedSuggestion.command));
        setSelectedHintIndex(previousIndex);
      }
    }
  };

  const applyAutocomplete = () => {
    handleTabComplete("forward");
  };

  const handleShiftTab = () => {
    handleTabComplete("backward");
  };

  const handleArrowUp = () => {
    if (hasModelSuggestions) {
      const newIndex = selectedHintIndex <= 0 ? modelSuggestions.length - 1 : selectedHintIndex - 1;
      const selectedModel = modelSuggestions[newIndex];

      if (selectedModel) {
        setInputValue(`/model ${selectedModel}`);
        setSelectedHintIndex(newIndex);
      }

      return;
    }

    if (hasCommandSuggestions) {
      const newIndex =
        selectedHintIndex <= 0 ? commandSuggestions.length - 1 : selectedHintIndex - 1;
      const selectedSuggestion = commandSuggestions[newIndex];

      if (selectedSuggestion) {
        setInputValue(getCompletedValue(selectedSuggestion.command));
        setSelectedHintIndex(newIndex);
      }

      return;
    }

    if (commandHistory.length === 0) {
      return;
    }

    if (historyIndex === null) {
      setSavedInputValue(inputValue);
      setHistoryIndex(commandHistory.length - 1);
      setInputValue(commandHistory.at(-1) ?? "");
    } else if (historyIndex > 0) {
      const newIndex = historyIndex - 1;

      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex] ?? "");
    }
  };

  const handleArrowDown = () => {
    if (hasModelSuggestions) {
      const newIndex = selectedHintIndex >= modelSuggestions.length - 1 ? 0 : selectedHintIndex + 1;
      const selectedModel = modelSuggestions[newIndex];

      if (selectedModel) {
        setInputValue(`/model ${selectedModel}`);
        setSelectedHintIndex(newIndex);
      }

      return;
    }

    if (hasCommandSuggestions) {
      const newIndex =
        selectedHintIndex >= commandSuggestions.length - 1 ? 0 : selectedHintIndex + 1;
      const selectedSuggestion = commandSuggestions[newIndex];

      if (selectedSuggestion) {
        setInputValue(getCompletedValue(selectedSuggestion.command));
        setSelectedHintIndex(newIndex);
      }

      return;
    }

    if (historyIndex === null) {
      return;
    }

    if (historyIndex >= commandHistory.length - 1) {
      setHistoryIndex(null);
      setInputValue(savedInputValue);
      setSavedInputValue("");
    } else {
      const newIndex = historyIndex + 1;

      setHistoryIndex(newIndex);
      setInputValue(commandHistory[newIndex] ?? "");
    }
  };

  const handleSubmit = (value: string) => {
    if (!value.trim()) {
      return;
    }

    const expandedValue = expandPastedSegments(value, pastedSegments);
    const parsed = parseSlashCommand(expandedValue);

    if (parsed) {
      if (isRunning && !RUNNING_COMMANDS.includes(parsed.command)) {
        setError(
          `Command /${parsed.command} not available while agent is running. Use /stop, /quit, or /help`,
        );
        setInputValue("");
        setPastedSegments([]);

        return;
      }

      addCommandToHistory(expandedValue);
      setCommandHistory(getCommandHistoryList());
      setError(null);
      setInputValue("");
      setPastedSegments([]);
      setSelectedHintIndex(0);
      setHistoryIndex(null);
      setSavedInputValue("");
      onCommand(parsed.command, parsed.args);
    } else {
      setError(`Unknown command: ${expandedValue}`);
      setInputValue("");
      setPastedSegments([]);
    }
  };

  const borderColor = isRunning ? "yellow" : "cyan";
  const promptColor = isRunning ? "yellow" : "cyan";
  const placeholder = isRunning ? "/stop" : "/command";
  const defaultHintText = isRunning
    ? "Press Escape or type /stop to stop the agent"
    : "Enter /help for a list of commands";

  const maxSuggestions = 5;

  const renderHint = (): React.ReactElement => {
    if (isNavigatingHistory && historyIndex !== null) {
      const positionText = `${historyIndex + 1}/${commandHistory.length}`;

      return (
        <Text dimColor>History ({positionText}) — ↑↓ navigate, Enter to use, type to exit</Text>
      );
    }

    if (autocomplete.type === "argument-hint" && autocomplete.argumentHint) {
      return <Text dimColor>{autocomplete.argumentHint}</Text>;
    }

    if (hasCommandSuggestions) {
      const windowStart = Math.max(
        0,
        Math.min(
          selectedHintIndex - Math.floor(maxSuggestions / 2),
          commandSuggestions.length - maxSuggestions,
        ),
      );
      const windowEnd = Math.min(windowStart + maxSuggestions, commandSuggestions.length);
      const displayedSuggestions = commandSuggestions.slice(windowStart, windowEnd);
      const itemsAbove = windowStart;
      const itemsBelow = commandSuggestions.length - windowEnd;
      const currentPartial = getCurrentPartialCommand();
      const commonPrefix = autocomplete.commonPrefix ?? "";
      const canExpandPrefix =
        commonPrefix.length > currentPartial.length &&
        currentPartial !== commonPrefix.toLowerCase();
      const tabHint = canExpandPrefix
        ? `Tab to complete "${commonPrefix}"`
        : commandSuggestions.length > 1
          ? "Tab/↑↓ to cycle"
          : "Tab to complete";

      return (
        <Box flexDirection="column">
          {itemsAbove > 0 && <Text dimColor> (+{itemsAbove} above)</Text>}
          {displayedSuggestions.map(({ command, hint }, index) => {
            const actualIndex = windowStart + index;
            const isSelected = actualIndex === selectedHintIndex;

            return (
              <Box key={command} gap={1}>
                <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                  {isSelected ? "▸" : " "}
                </Text>
                <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                  /{command}
                </Text>
                {hint.args && <Text dimColor>{hint.args}</Text>}
                <Text dimColor>— {hint.description}</Text>
              </Box>
            );
          })}
          <Box gap={1}>
            {itemsBelow > 0 && <Text dimColor>(+{itemsBelow} below)</Text>}
            <Text dimColor>[{tabHint}]</Text>
          </Box>
        </Box>
      );
    }

    if (hasModelSuggestions) {
      const windowStart = Math.max(
        0,
        Math.min(
          selectedHintIndex - Math.floor(maxSuggestions / 2),
          modelSuggestions.length - maxSuggestions,
        ),
      );
      const windowEnd = Math.min(windowStart + maxSuggestions, modelSuggestions.length);
      const displayedSuggestions = modelSuggestions.slice(windowStart, windowEnd);
      const itemsAbove = windowStart;
      const itemsBelow = modelSuggestions.length - windowEnd;
      const currentPartial = getCurrentModelPartial();
      const commonPrefix = autocomplete.commonPrefix ?? "";
      const canExpandPrefix =
        commonPrefix.length > currentPartial.length &&
        currentPartial !== commonPrefix.toLowerCase();
      const tabHint = canExpandPrefix
        ? `Tab to complete "${commonPrefix}"`
        : modelSuggestions.length > 1
          ? "Tab/↑↓ to cycle"
          : "Tab to complete";

      return (
        <Box flexDirection="column">
          {itemsAbove > 0 && <Text dimColor> (+{itemsAbove} above)</Text>}
          {displayedSuggestions.map((modelIdentifier, index) => {
            const actualIndex = windowStart + index;
            const isSelected = actualIndex === selectedHintIndex;

            return (
              <Box key={modelIdentifier} gap={1}>
                <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                  {isSelected ? "▸" : " "}
                </Text>
                <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                  {modelIdentifier}
                </Text>
              </Box>
            );
          })}
          <Box gap={1}>
            {itemsBelow > 0 && <Text dimColor>(+{itemsBelow} below)</Text>}
            <Text dimColor>[{tabHint}]</Text>
          </Box>
        </Box>
      );
    }

    if (inputValue.trim().toLowerCase().startsWith("/model") && isModelLoading) {
      return <Text dimColor>Loading models for current agent...</Text>;
    }

    return <Text dimColor>{defaultHintText}</Text>;
  };

  return (
    <Box flexDirection="column">
      <Box paddingLeft={1} marginBottom={hasSuggestions ? 0 : 0}>
        {renderHint()}
      </Box>
      <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1}>
        <Box gap={1}>
          <Text color={promptColor}>❯</Text>
          <TextInput
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            collapsePastedText
            pastedSegments={pastedSegments}
            onPaste={handlePaste}
            onArrowUp={handleArrowUp}
            onArrowDown={handleArrowDown}
            onTab={applyAutocomplete}
            onShiftTab={handleShiftTab}
            onArrowRight={applyAutocomplete}
            focus={!helpMode}
          />
        </Box>
        {error && (
          <Box>
            <Text color="red">{error}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
