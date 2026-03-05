import { useCallback, useState } from "react";
import { match } from "ts-pattern";
import type { CommandArgs, SlashCommand } from "@/components/CommandInput.tsx";
import { UI_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";
import { handleShutdownSignal } from "@/lib/daemon.ts";
import {
  getGuardrailsService,
  getPrdService,
  getSessionMemoryService,
} from "@/lib/services/index.ts";
import type { ActiveView, SetManualTaskResult } from "@/types.ts";

interface SlashCommandMessage {
  type: "success" | "error";
  text: string;
}

interface RefreshStateResult {
  success: boolean;
  taskCount: number;
  currentTaskIndex: number;
  error?: string;
}

interface UseSlashCommandsDependencies {
  startIterations: (iterations?: number, full?: boolean) => void;
  resumeSession: () => void;
  stopAgent: () => void;
  setManualNextTask: (taskIdentifier: string) => SetManualTaskResult;
  agentStop: () => void;
  iterationPause: () => void;
  setActiveView: (view: ActiveView) => void;
  getCurrentTaskTitle?: () => string | null;
  dismissUpdateBanner?: () => void;
  refreshState?: () => RefreshStateResult;
  clearSession?: () => void;
}

interface ClearResult {
  tasksArchived: number;
  progressArchived: boolean;
}

interface UseSlashCommandsResult {
  handleSlashCommand: (command: SlashCommand, args?: CommandArgs) => void;
  handleClearConfirm: (result: ClearResult) => void;
  handleClearCancel: () => void;
  dismissHelp: () => void;
  nextTaskMessage: SlashCommandMessage | null;
  guardrailMessage: SlashCommandMessage | null;
  memoryMessage: SlashCommandMessage | null;
  refreshMessage: SlashCommandMessage | null;
  clearMessage: SlashCommandMessage | null;
  taskMessage: SlashCommandMessage | null;
  helpVisible: boolean;
}

function getViewForCommand(command: SlashCommand): ActiveView {
  if (command === "add") {
    return "add";
  }

  return command as ActiveView;
}

export function useSlashCommands({
  startIterations,
  resumeSession,
  stopAgent,
  setManualNextTask,
  agentStop,
  iterationPause,
  setActiveView,
  getCurrentTaskTitle,
  dismissUpdateBanner,
  refreshState,
  clearSession,
}: UseSlashCommandsDependencies): UseSlashCommandsResult {
  const [nextTaskMessage, setNextTaskMessage] = useState<SlashCommandMessage | null>(null);
  const [guardrailMessage, setGuardrailMessage] = useState<SlashCommandMessage | null>(null);
  const [memoryMessage, setMemoryMessage] = useState<SlashCommandMessage | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<SlashCommandMessage | null>(null);
  const [clearMessage, setClearMessage] = useState<SlashCommandMessage | null>(null);
  const [taskMessage, setTaskMessage] = useState<SlashCommandMessage | null>(null);
  const [helpVisible, setHelpVisible] = useState(false);

  const handleSlashCommand = useCallback(
    (command: SlashCommand, args?: CommandArgs) => {
      match(command)
        .with("session", () => {
          match(args?.sessionSubcommand)
            .with("start", () => {
              startIterations(args?.iterations, args?.full);
            })
            .with("stop", () => {
              stopAgent();
            })
            .with("resume", () => {
              resumeSession();
            })
            .with("pause", () => {
              agentStop();
              iterationPause();
            })
            .with("clear", () => {
              agentStop();
              iterationPause();
              setActiveView("confirm-clear");
            })
            .with("refresh", () => {
              if (refreshState) {
                const refreshResult = refreshState();

                if (refreshResult.success) {
                  const taskDisplay =
                    refreshResult.currentTaskIndex >= 0
                      ? `Task ${refreshResult.currentTaskIndex + 1}/${refreshResult.taskCount}`
                      : `${refreshResult.taskCount} tasks (all done)`;

                  setRefreshMessage({
                    text: `Refreshed: ${taskDisplay}`,
                    type: "success",
                  });
                } else {
                  setRefreshMessage({
                    text: refreshResult.error ?? "Failed to refresh state",
                    type: "error",
                  });
                }

                setTimeout(() => setRefreshMessage(null), UI_MESSAGE_TIMEOUT_MS);
              }
            })
            .with("archive", () => {
              agentStop();
              iterationPause();
              setActiveView("archive");
            })
            .with(undefined, () => {})
            .exhaustive();
        })
        .with("next", () => {
          if (args?.taskIdentifier) {
            const taskSetResult = setManualNextTask(args.taskIdentifier);

            if (taskSetResult.success) {
              setNextTaskMessage({
                text: `Next task set to: ${taskSetResult.taskTitle}`,
                type: "success",
              });
            } else {
              setNextTaskMessage({
                text: taskSetResult.error ?? "Failed to set next task",
                type: "error",
              });
            }

            setTimeout(() => setNextTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
          } else {
            setNextTaskMessage({ text: "Usage: /next <task number or title>", type: "error" });
            setTimeout(() => setNextTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
          }
        })
        .with("guardrail", () => {
          if (args?.guardrailInstruction) {
            try {
              const guardrail = getGuardrailsService().add({
                instruction: args.guardrailInstruction,
              });

              setGuardrailMessage({
                text: `Added guardrail: "${guardrail.instruction}"`,
                type: "success",
              });
            } catch {
              setGuardrailMessage({
                text: "Failed to add guardrail",
                type: "error",
              });
            }

            setTimeout(() => setGuardrailMessage(null), UI_MESSAGE_TIMEOUT_MS);
          } else {
            setGuardrailMessage({
              text: "Usage: /guardrail <instruction>",
              type: "error",
            });
            setTimeout(() => setGuardrailMessage(null), UI_MESSAGE_TIMEOUT_MS);
          }
        })
        .with("guardrails", () => {
          agentStop();
          iterationPause();
          setActiveView("guardrails");
        })
        .with("learn", () => {
          if (args?.lesson) {
            try {
              getSessionMemoryService().addLesson(args.lesson);
              setMemoryMessage({
                text: `Added lesson: "${args.lesson}"`,
                type: "success",
              });
            } catch {
              setMemoryMessage({
                text: "Failed to add lesson",
                type: "error",
              });
            }

            setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
          } else {
            setMemoryMessage({
              text: "Usage: /learn <lesson>",
              type: "error",
            });
            setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
          }
        })
        .with("note", () => {
          if (args?.note) {
            const taskTitle = getCurrentTaskTitle?.();

            if (taskTitle) {
              try {
                getSessionMemoryService().addTaskNote(taskTitle, args.note);
                setMemoryMessage({
                  text: `Added note to task: "${taskTitle}"`,
                  type: "success",
                });
              } catch {
                setMemoryMessage({
                  text: "Failed to add note",
                  type: "error",
                });
              }
            } else {
              setMemoryMessage({
                text: "No current task to add note to",
                type: "error",
              });
            }

            setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
          } else {
            setMemoryMessage({
              text: "Usage: /note <note>",
              type: "error",
            });
            setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
          }
        })
        .with("memory", () => {
          agentStop();
          iterationPause();
          setActiveView("memory");
        })
        .with("task", () => {
          if (args?.taskSubcommand === "list") {
            agentStop();
            iterationPause();
            setActiveView("tasks");

            return;
          }

          if (args?.taskSubcommand === "current") {
            const prd = getPrdService().get();

            if (!prd) {
              setTaskMessage({ text: "No PRD found", type: "error" });
              setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

              return;
            }

            const nextPendingIndex = prd.tasks.findIndex((task) => !task.done);

            if (nextPendingIndex === -1) {
              setTaskMessage({ text: "All tasks complete!", type: "success" });
            } else {
              const currentTask = prd.tasks.at(nextPendingIndex);

              setTaskMessage({
                text: `Current task: [${nextPendingIndex + 1}] ${currentTask?.title}`,
                type: "success",
              });
            }

            setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

            return;
          }

          if (args?.taskSubcommand === "done" || args?.taskSubcommand === "undone") {
            const isDone = args.taskSubcommand === "done";

            if (!args.taskIdentifier?.trim()) {
              setTaskMessage({
                text: `Usage: /task ${args.taskSubcommand} <task number or title>`,
                type: "error",
              });
              setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

              return;
            }

            const prdService = getPrdService();
            const prd = prdService.get();

            if (!prd) {
              setTaskMessage({ text: "No PRD found", type: "error" });
              setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

              return;
            }

            const trimmedIdentifier = args.taskIdentifier.trim();
            const parsed = Number.parseInt(trimmedIdentifier, 10);
            let taskIndex: number | null = null;

            if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= prd.tasks.length) {
              taskIndex = parsed - 1;
            } else {
              const normalizedIdentifier = trimmedIdentifier.toLowerCase();
              const matchingIndex = prd.tasks.findIndex(
                (task) => task.title.toLowerCase() === normalizedIdentifier,
              );

              if (matchingIndex !== -1) {
                taskIndex = matchingIndex;
              }
            }

            if (taskIndex === null) {
              setTaskMessage({
                text: `Task not found: "${trimmedIdentifier}"`,
                type: "error",
              });
              setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

              return;
            }

            const task = prd.tasks.at(taskIndex);

            if (!task) {
              setTaskMessage({
                text: `Task not found: "${trimmedIdentifier}"`,
                type: "error",
              });
              setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

              return;
            }

            const isAlreadyInState = isDone ? task.done : !task.done;

            if (isAlreadyInState) {
              setTaskMessage({
                text: `Task [${taskIndex + 1}] "${task.title}" was already ${isDone ? "done" : "pending"}`,
                type: "success",
              });
            } else {
              const updatedTasks = prd.tasks.map((currentTask, index) =>
                index === taskIndex ? { ...currentTask, done: isDone } : currentTask,
              );

              prdService.save({ ...prd, tasks: updatedTasks });
              setTaskMessage({
                text: `Marked task [${taskIndex + 1}] "${task.title}" as ${isDone ? "done" : "pending"}`,
                type: "success",
              });

              refreshState?.();
            }

            setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
          }
        })
        .with("help", () => {
          setHelpVisible((prev) => !prev);
        })
        .with(
          "init",
          "setup",
          "update",
          "add",
          "status",
          "analyze",
          "agent",
          "tasks",
          "projects",
          "plan",
          "usage",
          "migrate",
          "config",
          "github",
          "auth",
          () => {
            agentStop();
            iterationPause();
            setActiveView(getViewForCommand(command));
          },
        )
        .with("dismiss-update", () => {
          dismissUpdateBanner?.();
        })
        .with("quit", "exit", "q", "e", () => {
          handleShutdownSignal("SIGTERM");
        })
        .exhaustive();
    },
    [
      agentStop,
      iterationPause,
      startIterations,
      resumeSession,
      stopAgent,
      setActiveView,
      setManualNextTask,
      getCurrentTaskTitle,
      dismissUpdateBanner,
      refreshState,
    ],
  );

  const handleClearConfirm = useCallback(
    (result: ClearResult) => {
      clearSession?.();

      const messages: string[] = [];

      if (result.tasksArchived > 0) {
        messages.push(
          `archived ${result.tasksArchived} task${result.tasksArchived === 1 ? "" : "s"}`,
        );
      }

      if (result.progressArchived) {
        messages.push("archived progress");
      }

      messages.push("session cleared");

      if (refreshState) {
        const refreshResult = refreshState();

        if (refreshResult.success) {
          const taskDisplay =
            refreshResult.currentTaskIndex >= 0
              ? `Task ${refreshResult.currentTaskIndex + 1}/${refreshResult.taskCount}`
              : `${refreshResult.taskCount} tasks (all done)`;

          messages.push(`refreshed: ${taskDisplay}`);
        }
      }

      setClearMessage({
        text: messages.join(", "),
        type: "success",
      });
      setActiveView("run");
      setTimeout(() => setClearMessage(null), UI_MESSAGE_TIMEOUT_MS);
    },
    [clearSession, refreshState, setActiveView],
  );

  const handleClearCancel = useCallback(() => {
    setActiveView("run");
  }, [setActiveView]);

  const dismissHelp = useCallback(() => {
    setHelpVisible(false);
  }, []);

  return {
    clearMessage,
    dismissHelp,
    guardrailMessage,
    handleClearCancel,
    handleClearConfirm,
    handleSlashCommand,
    helpVisible,
    memoryMessage,
    nextTaskMessage,
    refreshMessage,
    taskMessage,
  };
}
