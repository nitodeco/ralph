import { useCallback, useState } from "react";
import { match } from "ts-pattern";
import type { CommandArgs, SlashCommand } from "@/components/CommandInput.tsx";
import { UI_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";
import { handleShutdownSignal } from "@/lib/daemon.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import {
	getGuardrailsService,
	getRulesService,
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
	ruleMessage: SlashCommandMessage | null;
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
	const [ruleMessage, setRuleMessage] = useState<SlashCommandMessage | null>(null);
	const [memoryMessage, setMemoryMessage] = useState<SlashCommandMessage | null>(null);
	const [refreshMessage, setRefreshMessage] = useState<SlashCommandMessage | null>(null);
	const [clearMessage, setClearMessage] = useState<SlashCommandMessage | null>(null);
	const [taskMessage, setTaskMessage] = useState<SlashCommandMessage | null>(null);
	const [helpVisible, setHelpVisible] = useState(false);

	const handleSlashCommand = useCallback(
		(command: SlashCommand, args?: CommandArgs) => {
			match(command)
				.with("start", () => {
					startIterations(args?.iterations, args?.full);
				})
				.with("resume", () => {
					resumeSession();
				})
				.with("stop", () => {
					stopAgent();
				})
				.with("next", () => {
					if (args?.taskIdentifier) {
						const taskSetResult = setManualNextTask(args.taskIdentifier);

						if (taskSetResult.success) {
							setNextTaskMessage({
								type: "success",
								text: `Next task set to: ${taskSetResult.taskTitle}`,
							});
						} else {
							setNextTaskMessage({
								type: "error",
								text: taskSetResult.error ?? "Failed to set next task",
							});
						}

						setTimeout(() => setNextTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setNextTaskMessage({ type: "error", text: "Usage: /next <task number or title>" });
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
				})
				.with("guardrails", () => {
					agentStop();
					iterationPause();
					setActiveView("guardrails");
				})
				.with("rule", () => {
					if (args?.ruleInstruction) {
						try {
							const rule = getRulesService().add({
								instruction: args.ruleInstruction,
							});

							setRuleMessage({
								type: "success",
								text: `Added rule: "${rule.instruction}"`,
							});
						} catch {
							setRuleMessage({
								type: "error",
								text: "Failed to add rule",
							});
						}

						setTimeout(() => setRuleMessage(null), UI_MESSAGE_TIMEOUT_MS);
					} else {
						setRuleMessage({
							type: "error",
							text: "Usage: /rule <instruction>",
						});
						setTimeout(() => setRuleMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}
				})
				.with("rules", () => {
					agentStop();
					iterationPause();
					setActiveView("rules");
				})
				.with("learn", () => {
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
				})
				.with("note", () => {
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
						const prd = loadPrd();

						if (!prd) {
							setTaskMessage({ type: "error", text: "No PRD found" });
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

							return;
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

						return;
					}

					if (args?.taskSubcommand === "done" || args?.taskSubcommand === "undone") {
						const isDone = args.taskSubcommand === "done";

						if (!args.taskIdentifier?.trim()) {
							setTaskMessage({
								type: "error",
								text: `Usage: /task ${args.taskSubcommand} <task number or title>`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

							return;
						}

						const prd = loadPrd();

						if (!prd) {
							setTaskMessage({ type: "error", text: "No PRD found" });
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
								type: "error",
								text: `Task not found: "${trimmedIdentifier}"`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

							return;
						}

						const task = prd.tasks.at(taskIndex);

						if (!task) {
							setTaskMessage({
								type: "error",
								text: `Task not found: "${trimmedIdentifier}"`,
							});
							setTimeout(() => setTaskMessage(null), UI_MESSAGE_TIMEOUT_MS);

							return;
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
					"archive",
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
								type: "success",
								text: `Refreshed: ${taskDisplay}`,
							});
						} else {
							setRefreshMessage({
								type: "error",
								text: refreshResult.error ?? "Failed to refresh state",
							});
						}

						setTimeout(() => setRefreshMessage(null), UI_MESSAGE_TIMEOUT_MS);
					}
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
				type: "success",
				text: messages.join(", "),
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
		handleSlashCommand,
		handleClearConfirm,
		handleClearCancel,
		dismissHelp,
		nextTaskMessage,
		guardrailMessage,
		ruleMessage,
		memoryMessage,
		refreshMessage,
		clearMessage,
		taskMessage,
		helpVisible,
	};
}
