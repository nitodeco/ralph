import { Box, Text, useApp, useInput } from "ink";
import { useRef, useState } from "react";
import { match } from "ts-pattern";
import { runAgentWithPrompt } from "@/lib/agent.ts";
import { loadConfig } from "@/lib/config.ts";
import { AGENT_OUTPUT_PREVIEW_MAX_CHARS } from "@/lib/constants/ui.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import { buildAddTaskPrompt, TASK_OUTPUT_END, TASK_OUTPUT_START } from "@/lib/prompt.ts";
import { isPrdTask } from "@/lib/services/index.ts";
import type { Prd, PrdTask } from "@/types.ts";
import { Message } from "./common/Message.tsx";
import { Spinner } from "./common/Spinner.tsx";
import { expandPastedSegments, type PastedTextSegment, TextInput } from "./common/TextInput.tsx";
import { Header } from "./Header.tsx";

interface AddTaskWizardProps {
	version: string;
	onComplete?: () => void;
}

type WizardStep = "check_prd" | "description" | "generating" | "complete" | "error";

interface WizardState {
	step: WizardStep;
	description: string;
	prd: Prd | null;
	addedTask: PrdTask | null;
	errorMessage: string | null;
	agentOutput: string;
}

function parseTaskFromOutput(output: string): PrdTask | null {
	const startMarker = TASK_OUTPUT_START;
	const endMarker = TASK_OUTPUT_END;

	const startIndex = output.indexOf(startMarker);
	const endIndex = output.indexOf(endMarker);

	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		return null;
	}

	const taskContent = output.slice(startIndex + startMarker.length, endIndex).trim();

	try {
		const parsed: unknown = JSON.parse(taskContent);

		if (!isPrdTask(parsed)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

export function AddTaskWizard({ version, onComplete }: AddTaskWizardProps): React.ReactElement {
	const { exit } = useApp();

	const handleExit = () => {
		if (onComplete) {
			onComplete();
		} else {
			exit();
		}
	};

	const existingPrd = loadPrd();
	const config = loadConfig();

	const getInitialStep = (): WizardStep => {
		if (!existingPrd) {
			return "check_prd";
		}

		return "description";
	};

	const [state, setState] = useState<WizardState>({
		step: getInitialStep(),
		description: "",
		prd: existingPrd,
		addedTask: null,
		errorMessage: null,
		agentOutput: "",
	});

	const [inputValue, setInputValue] = useState("");
	const [pastedSegments, setPastedSegments] = useState<PastedTextSegment[]>([]);
	const abortRef = useRef<(() => void) | null>(null);

	const handlePaste = (segment: PastedTextSegment) => {
		setPastedSegments((prev) => [...prev, segment]);
	};

	const handleGenerationCancel = () => {
		if (abortRef.current) {
			abortRef.current();
		}
	};

	const handleDescriptionSubmit = async (value: string) => {
		const expandedValue = expandPastedSegments(value, pastedSegments);
		const description = expandedValue.trim();

		if (!description) {
			return;
		}

		if (!state.prd) {
			setState((prev) => ({
				...prev,
				step: "error",
				errorMessage: "No PRD found. Run 'ralph init' first.",
			}));

			return;
		}

		setPastedSegments([]);
		setState((prev) => ({
			...prev,
			description,
			step: "generating",
			agentOutput: "",
		}));

		try {
			const prompt = buildAddTaskPrompt(description, state.prd);
			const { promise, abort } = runAgentWithPrompt({
				prompt,
				agentType: config.agent,
				onOutput: (chunk) => {
					setState((prev) => ({
						...prev,
						agentOutput: prev.agentOutput + chunk,
					}));
				},
			});

			abortRef.current = abort;

			const output = await promise;

			abortRef.current = null;

			const task = parseTaskFromOutput(output);

			if (!task) {
				setState((prev) => ({
					...prev,
					step: "error",
					errorMessage:
						"Failed to parse task from agent output. The agent may not have followed the expected format.",
				}));

				return;
			}

			const updatedPrd: Prd = {
				...state.prd,
				tasks: [...state.prd.tasks, task],
			};

			savePrd(updatedPrd);

			setState((prev) => ({
				...prev,
				prd: updatedPrd,
				addedTask: task,
				step: "complete",
			}));
		} catch (error) {
			abortRef.current = null;
			const errorMessage = getErrorMessage(error);

			if (errorMessage === "Agent generation was cancelled") {
				handleExit();

				return;
			}

			setState((prev) => ({
				...prev,
				step: "error",
				errorMessage,
			}));
		}
	};

	useInput((input, key) => {
		if (state.step === "complete" || state.step === "error" || state.step === "check_prd") {
			if (key.return || key.escape) {
				handleExit();
			}
		}

		if (state.step === "generating") {
			if (key.escape || input === "q") {
				handleGenerationCancel();
			}
		}
	});

	const renderStep = () => {
		return match(state.step)
			.with("check_prd", () => (
				<Box flexDirection="column" gap={1}>
					<Message type="error">No PRD found in this project.</Message>
					<Text dimColor>Run 'ralph init' to create a PRD first.</Text>
					<Text dimColor>Press Enter to exit</Text>
				</Box>
			))
			.with("description", () => (
				<Box flexDirection="column" gap={1}>
					<Text dimColor>Project: {state.prd?.project}</Text>
					<Text dimColor>Current tasks: {state.prd?.tasks.length ?? 0}</Text>
					<Box marginTop={1} flexDirection="column" gap={1}>
						<Text color="cyan">Describe the task you want to add:</Text>
						<Box>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleDescriptionSubmit}
								placeholder="I want to add..."
								collapsePastedText
								pastedSegments={pastedSegments}
								onPaste={handlePaste}
							/>
						</Box>
					</Box>
				</Box>
			))
			.with("generating", () => (
				<Box flexDirection="column" gap={1}>
					<Spinner label="Generating task from your description..." />
					{state.agentOutput && (
						<Box marginTop={1} flexDirection="column">
							<Text dimColor>Agent output:</Text>
							<Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
								<Text dimColor>{state.agentOutput.slice(-AGENT_OUTPUT_PREVIEW_MAX_CHARS)}</Text>
							</Box>
						</Box>
					)}
					<Box marginTop={1}>
						<Text dimColor>q/Esc Cancel</Text>
					</Box>
				</Box>
			))
			.with("complete", () => (
				<Box flexDirection="column" gap={1}>
					<Message type="success">Task added successfully!</Message>
					{state.addedTask && (
						<Box flexDirection="column" marginTop={1}>
							<Text>
								<Text dimColor>Title:</Text> <Text color="yellow">{state.addedTask.title}</Text>
							</Text>
							<Text>
								<Text dimColor>Description:</Text> {state.addedTask.description}
							</Text>
							{state.addedTask.steps.length > 0 && (
								<Box flexDirection="column" marginTop={1}>
									<Text dimColor>Steps:</Text>
									{state.addedTask.steps.map((step, index) => (
										<Text key={step}>
											<Text dimColor> {index + 1}.</Text> {step}
										</Text>
									))}
								</Box>
							)}
						</Box>
					)}
					<Box marginTop={1}>
						<Text dimColor>Total tasks: {state.prd?.tasks.length ?? 0}</Text>
					</Box>
					<Text dimColor>Press Enter to continue</Text>
				</Box>
			))
			.with("error", () => (
				<Box flexDirection="column" gap={1}>
					<Message type="error">Error: {state.errorMessage}</Message>
					<Text dimColor>Press Enter to exit</Text>
				</Box>
			))
			.exhaustive();
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text bold>Add task to PRD</Text>
				</Box>
				{renderStep()}
			</Box>
		</Box>
	);
}
