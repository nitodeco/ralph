import { useCallback, useState } from "react";
import type { CommandArgs, SlashCommand } from "@/components/CommandInput.tsx";
import { addGuardrail } from "@/lib/guardrails.ts";
import { addLesson, addTaskNote } from "@/lib/session-memory.ts";
import type { ActiveView, SetManualTaskResult } from "@/types/index.ts";

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
}

interface UseSlashCommandsResult {
	handleSlashCommand: (command: SlashCommand, args?: CommandArgs) => void;
	nextTaskMessage: SlashCommandMessage | null;
	guardrailMessage: SlashCommandMessage | null;
	memoryMessage: SlashCommandMessage | null;
	refreshMessage: SlashCommandMessage | null;
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
}: UseSlashCommandsDependencies): UseSlashCommandsResult {
	const [nextTaskMessage, setNextTaskMessage] = useState<SlashCommandMessage | null>(null);
	const [guardrailMessage, setGuardrailMessage] = useState<SlashCommandMessage | null>(null);
	const [memoryMessage, setMemoryMessage] = useState<SlashCommandMessage | null>(null);
	const [refreshMessage, setRefreshMessage] = useState<SlashCommandMessage | null>(null);

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
						setTimeout(() => setNextTaskMessage(null), 5000);
					} else {
						setNextTaskMessage({ type: "error", text: "Usage: /next <task number or title>" });
						setTimeout(() => setNextTaskMessage(null), 5000);
					}
					break;
				case "guardrail":
					if (args?.guardrailInstruction) {
						try {
							const guardrail = addGuardrail({ instruction: args.guardrailInstruction });
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
						setTimeout(() => setGuardrailMessage(null), 5000);
					} else {
						setGuardrailMessage({
							type: "error",
							text: "Usage: /guardrail <instruction>",
						});
						setTimeout(() => setGuardrailMessage(null), 5000);
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
							addLesson(args.lesson);
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
						setTimeout(() => setMemoryMessage(null), 5000);
					} else {
						setMemoryMessage({
							type: "error",
							text: "Usage: /learn <lesson>",
						});
						setTimeout(() => setMemoryMessage(null), 5000);
					}
					break;
				case "note":
					if (args?.note) {
						const taskTitle = getCurrentTaskTitle?.();
						if (taskTitle) {
							try {
								addTaskNote(taskTitle, args.note);
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
						setTimeout(() => setMemoryMessage(null), 5000);
					} else {
						setMemoryMessage({
							type: "error",
							text: "Usage: /note <note>",
						});
						setTimeout(() => setMemoryMessage(null), 5000);
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
					agentStop();
					iterationPause();
					setActiveView(command === "add" ? "add" : command);
					break;
				case "dismiss-update":
					dismissUpdateBanner?.();
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
						setTimeout(() => setRefreshMessage(null), 5000);
					}
					break;
				case "quit":
				case "exit":
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
		],
	);

	return { handleSlashCommand, nextTaskMessage, guardrailMessage, memoryMessage, refreshMessage };
}
