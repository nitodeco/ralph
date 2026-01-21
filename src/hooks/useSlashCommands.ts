import { useCallback, useState } from "react";
import type { CommandArgs, SlashCommand } from "@/components/CommandInput.tsx";
import { performSessionArchive } from "@/lib/archive.ts";
import { UI_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";
import { handleShutdownSignal } from "@/lib/daemon.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import {
	getGuardrailsService,
	getSessionMemoryService,
	getSessionService,
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

interface UseSlashCommandsResult {
	handleSlashCommand: (command: SlashCommand, args?: CommandArgs) => void;
	nextTaskMessage: SlashCommandMessage | null;
	guardrailMessage: SlashCommandMessage | null;
	memoryMessage: SlashCommandMessage | null;
	refreshMessage: SlashCommandMessage | null;
	clearMessage: SlashCommandMessage | null;
	taskMessage: SlashCommandMessage | null;
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

	const handleSlashCommand = useCallback(
		(command: SlashCommand, args?: CommandArgs) => {
			switch (command) {
				case "start":
					startIterations(args?.iterations, args?.full);
					break;
				case "resume":
					resumeSession();
					break;
				case "stop":
					stopAgent();
					break;
				case "next":
					if (args?.taskIdentifier) {
						const result = setManualNextTask(args.taskIdentifier);

						if (result.success) {
							setNextTaskMessage({
								type: "success",
								text: `Next task set to: ${result.taskTitle}`,
							});
						} else {
							setNextTaskMessage({
								type: "error",
								text: result.error ?? "Failed to set next task",
							});
						}

						setTimeout(() => setNextTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setNextTaskMessage({ type: "error", text: "Usage: /next <task number or title>" });
						setTimeout(() => setNextTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}

					break;
				case "guardrail":
					if (args?.guardrailInstruction) {
						try {
							const guardrail = getGuardrailsService().add({
								instruction: args.guardrailInstruction,
							});

							setGuardrailMessage({
								type: "success",
								text: `Added guardrail: "${guardrail.instruction}"`,
							});
						} catch {
							setGuardrailMessage({
								type: "error",
								text: "Failed to add guardrail",
							});
						}

						setTimeout(() => setGuardrailMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setGuardrailMessage({
							type: "error",
							text: "Usage: /guardrail <instruction>",
						});
						setTimeout(() => setGuardrailMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}

					break;
				case "guardrails":
					agentStop();
					iterationPause();
					setActiveView("guardrails");
					break;
				case "learn":
					if (args?.lesson) {
						try {
							getSessionMemoryService().addLesson(args.lesson);
							setMemoryMessage({
								type: "success",
								text: `Added lesson: "${args.lesson}"`,
							});
						} catch {
							setMemoryMessage({
								type: "error",
								text: "Failed to add lesson",
							});
						}

						setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setMemoryMessage({
							type: "error",
							text: "Usage: /learn <lesson>",
						});
						setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}

					break;
				case "note":
					if (args?.note) {
						const taskTitle = getCurrentTaskTitle?.();

						if (taskTitle) {
							try {
								getSessionMemoryService().addTaskNote(taskTitle, args.note);
								setMemoryMessage({
									type: "success",
									text: `Added note to task: "${taskTitle}"`,
								});
							} catch {
								setMemoryMessage({
									type: "error",
									text: "Failed to add note",
								});
							}
						} else {
							setMemoryMessage({
								type: "error",
								text: "No current task to add note to",
							});
						}

						setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setMemoryMessage({
							type: "error",
							text: "Usage: /note <note>",
						});
						setTimeout(() => setMemoryMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}

					break;
				case "memory":
					agentStop();
					iterationPause();
					setActiveView("memory");
					break;
				case "task":
					if (args?.taskSubcommand === "list") {
						agentStop();
						iterationPause();
						setActiveView("tasks");
						break;
					}

					if (args?.taskSubcommand === "current") {
						const prd = loadPrd();

						if (!prd) {
							setTaskMessage({ type: "error", text: "No PRD found" });
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
							break;
						}

						const nextPendingIndex = prd.tasks.findIndex((task) => !task.done);

						if (nextPendingIndex === -1) {
							setTaskMessage({ type: "success", text: "All tasks complete!" });
						} else {
							const currentTask = prd.tasks.at(nextPendingIndex);

							setTaskMessage({
								type: "success",
								text: `Current task: [${nextPendingIndex + 1}] ${currentTask?.title}`,
							});
						}

						setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
						break;
					}

					if (args?.taskSubcommand === "done" || args?.taskSubcommand === "undone") {
						const isDone = args.taskSubcommand === "done";

						if (!args.taskIdentifier?.trim()) {
							setTaskMessage({
								type: "error",
								text: `Usage: /task ${args.taskSubcommand} <task number or title>`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
							break;
						}

						const prd = loadPrd();

						if (!prd) {
							setTaskMessage({ type: "error", text: "No PRD found" });
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
							break;
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
								type: "error",
								text: `Task not found: "${trimmedIdentifier}"`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
							break;
						}

						const task = prd.tasks.at(taskIndex);

						if (!task) {
							setTaskMessage({
								type: "error",
								text: `Task not found: "${trimmedIdentifier}"`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
							break;
						}

						const isAlreadyInState = isDone ? task.done : !task.done;

						if (isAlreadyInState) {
							setTaskMessage({
								type: "success",
								text: `Task [${taskIndex + 1}] "${task.title}" was already ${isDone ? "done" : "pending"}`,
							});
						} else {
							const updatedTasks = prd.tasks.map((currentTask, index) =>
								index === taskIndex ? { ...currentTask, done: isDone } : currentTask,
							);

							savePrd({ ...prd, tasks: updatedTasks });
							setTaskMessage({
								type: "success",
								text: `Marked task [${taskIndex + 1}] "${task.title}" as ${isDone ? "done" : "pending"}`,
							});

							refreshState?.();
						}

						setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
						break;
					}

					break;
				case "init":
				case "setup":
				case "update":
				case "help":
				case "add":
				case "status":
				case "archive":
				case "analyze":
				case "agent":
				case "tasks":
				case "projects":
				case "plan":
					agentStop();
					iterationPause();
					setActiveView(getViewForCommand(command));
					break;
				case "dismiss-update":
					dismissUpdateBanner?.();
					break;
				case "clear":
					try {
						const archiveResult = performSessionArchive();

						getSessionService().delete();
						clearSession?.();

						const messages: string[] = [];

						if (archiveResult.tasksArchived > 0) {
							messages.push(
								`archived ${archiveResult.tasksArchived} task${archiveResult.tasksArchived === 1 ? "" : "s"}`,
							);
						}

						if (archiveResult.progressArchived) {
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
							type: "success",
							text: messages.join(", "),
						});
					} catch {
						setClearMessage({
							type: "error",
							text: "Failed to clear session",
						});
					}

					setTimeout(() => setClearMessage(null), UI_MESSAGE_TIMEOUT_MS);
					break;
				case "refresh":
					if (refreshState) {
						const result = refreshState();

						if (result.success) {
							const taskDisplay =
								result.currentTaskIndex >= 0
									? `Task ${result.currentTaskIndex + 1}/${result.taskCount}`
									: `${result.taskCount} tasks (all done)`;

							setRefreshMessage({
								type: "success",
								text: `Refreshed: ${taskDisplay}`,
							});
						} else {
							setRefreshMessage({
								type: "error",
								text: result.error ?? "Failed to refresh state",
							});
						}

						setTimeout(() => setRefreshMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}

					break;
				case "quit":
				case "exit":
					process.stdout.write("\x1b[2J\x1b[H");
					handleShutdownSignal("SIGTERM");
					break;
			}
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
			clearSession,
		],
	);

	return {
		handleSlashCommand,
		nextTaskMessage,
		guardrailMessage,
		memoryMessage,
		refreshMessage,
		clearMessage,
		taskMessage,
	};
}
