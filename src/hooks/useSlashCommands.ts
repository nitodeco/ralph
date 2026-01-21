import { execSync } from "node:child_process";
import { useCallback, useState } from "react";
import type { CommandArgs, SlashCommand } from "@/components/CommandInput.tsx";
import { performSessionArchive } from "@/lib/archive.ts";
import { UI_MESSAGE_TIMEOUT_MS } from "@/lib/constants/ui.ts";
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
	exit: () => void;
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
}

function getViewForCommand(command: SlashCommand): ActiveView {
	if (command === "add") {
		return "add";
	}

	if (command === "migrate") {
		return "migration_prompt";
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
	exit,
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
				case "migrate":
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
					try {
						execSync("clear", { stdio: "inherit" });
					} catch {
						// Ignore errors - still exit even if clear fails
					}

					exit();
					break;
			}
		},
		[
			agentStop,
			iterationPause,
			exit,
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
	};
}
