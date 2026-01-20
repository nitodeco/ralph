import { existsSync, writeFileSync } from "node:fs";
import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { parse as parseYaml } from "yaml";
import { runAgentWithPrompt } from "@/lib/agent.ts";
import { loadGlobalConfig, saveConfig } from "@/lib/config.ts";
import { ensureRalphDirExists, RALPH_DIR } from "@/lib/paths.ts";
import { findPrdFile, savePrd } from "@/lib/prd.ts";
import { PROGRESS_FILE_PATH } from "@/lib/progress.ts";
import { buildPrdGenerationPrompt, PRD_OUTPUT_END, PRD_OUTPUT_START } from "@/lib/prompt.ts";
import type { AgentType, Prd, PrdFormat, RalphConfig } from "@/types.ts";
import { Message } from "./common/Message.tsx";
import { Spinner } from "./common/Spinner.tsx";
import { TextInput } from "./common/TextInput.tsx";
import { Header } from "./Header.tsx";

interface InitWizardProps {
	version: string;
	onComplete?: () => void;
}

type WizardStep =
	| "check_existing_prd"
	| "check_existing_progress"
	| "agent_type"
	| "format"
	| "description"
	| "generating"
	| "complete"
	| "error"
	| "aborted";

interface WizardState {
	step: WizardStep;
	agentType: AgentType;
	prdFormat: PrdFormat;
	description: string;
	generatedPrd: Prd | null;
	existingPrdPath: string | null;
	existingProgressPath: boolean;
	errorMessage: string | null;
	agentOutput: string;
}

const AGENT_CHOICES = [
	{ label: "Cursor", value: "cursor" as const },
	{ label: "Claude Code", value: "claude" as const },
];

const YES_NO_CHOICES = [
	{ label: "Yes", value: true },
	{ label: "No", value: false },
];

const FORMAT_CHOICES = [
	{ label: "JSON", value: "json" as const },
	{ label: "YAML", value: "yaml" as const },
];

function parsePrdFromOutput(output: string, format: PrdFormat): Prd | null {
	const startMarker = PRD_OUTPUT_START;
	const endMarker = PRD_OUTPUT_END;

	const startIndex = output.indexOf(startMarker);
	const endIndex = output.indexOf(endMarker);

	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		return null;
	}

	const prdContent = output.slice(startIndex + startMarker.length, endIndex).trim();

	try {
		if (format === "yaml") {
			return parseYaml(prdContent) as Prd;
		}

		return JSON.parse(prdContent) as Prd;
	} catch {
		return null;
	}
}

export function InitWizard({ version, onComplete }: InitWizardProps): React.ReactElement {
	const { exit } = useApp();

	const handleExit = () => {
		if (onComplete) {
			onComplete();
		} else {
			exit();
		}
	};

	const existingPrd = findPrdFile();
	const existingProgress = existsSync(PROGRESS_FILE_PATH);
	const globalConfig = loadGlobalConfig();

	const getInitialStep = (): WizardStep => {
		if (existingPrd) {
			return "check_existing_prd";
		}

		if (existingProgress) {
			return "check_existing_progress";
		}

		return "agent_type";
	};

	const [state, setState] = useState<WizardState>({
		step: getInitialStep(),
		agentType: globalConfig.agent,
		prdFormat: globalConfig.prdFormat ?? "json",
		description: "",
		generatedPrd: null,
		existingPrdPath: existingPrd,
		existingProgressPath: existingProgress,
		errorMessage: null,
		agentOutput: "",
	});

	const [inputValue, setInputValue] = useState("");

	const handleConfirmOverwritePrd = (item: { value: boolean }) => {
		if (!item.value) {
			setState((prev) => ({ ...prev, step: "aborted" }));

			return;
		}

		if (state.existingProgressPath) {
			setState((prev) => ({ ...prev, step: "check_existing_progress" }));
		} else {
			setState((prev) => ({ ...prev, step: "agent_type" }));
		}
	};

	const handleConfirmOverwriteProgress = (item: { value: boolean }) => {
		if (!item.value) {
			setState((prev) => ({ ...prev, step: "aborted" }));

			return;
		}

		setState((prev) => ({ ...prev, step: "agent_type" }));
	};

	const handleAgentSelect = (item: { value: AgentType }) => {
		setState((prev) => ({ ...prev, agentType: item.value, step: "format" }));
	};

	const handleFormatSelect = (item: { value: PrdFormat }) => {
		setState((prev) => ({ ...prev, prdFormat: item.value, step: "description" }));
		setInputValue("");
	};

	const handleDescriptionSubmit = async (value: string) => {
		const description = value.trim();

		if (!description) {
			return;
		}

		setState((prev) => ({
			...prev,
			description,
			step: "generating",
			agentOutput: "",
		}));

		try {
			const prompt = buildPrdGenerationPrompt(description, state.prdFormat);
			const output = await runAgentWithPrompt({
				prompt,
				agentType: state.agentType,
				onOutput: (chunk) => {
					setState((prev) => ({
						...prev,
						agentOutput: prev.agentOutput + chunk,
					}));
				},
			});

			const prd = parsePrdFromOutput(output, state.prdFormat);

			if (!prd) {
				setState((prev) => ({
					...prev,
					step: "error",
					errorMessage:
						"Failed to parse PRD from agent output. The agent may not have followed the expected format.",
				}));

				return;
			}

			ensureRalphDirExists();
			savePrd(prd, state.prdFormat);
			writeFileSync(PROGRESS_FILE_PATH, "");

			const config: RalphConfig = { agent: state.agentType };

			saveConfig(config);

			setState((prev) => ({
				...prev,
				generatedPrd: prd,
				step: "complete",
			}));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			setState((prev) => ({
				...prev,
				step: "error",
				errorMessage,
			}));
		}
	};

	useInput((_, key) => {
		if (state.step === "complete" || state.step === "aborted" || state.step === "error") {
			if (key.return || key.escape) {
				handleExit();
			}
		}
	});

	const renderStep = () => {
		switch (state.step) {
			case "check_existing_prd":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="yellow">
							A PRD file already exists ({state.existingPrdPath}). Overwrite it?
						</Text>
						<SelectInput items={YES_NO_CHOICES} onSelect={handleConfirmOverwritePrd} />
					</Box>
				);

			case "check_existing_progress":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="yellow">{PROGRESS_FILE_PATH} already exists. Overwrite it?</Text>
						<SelectInput items={YES_NO_CHOICES} onSelect={handleConfirmOverwriteProgress} />
					</Box>
				);

			case "agent_type":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Which AI agent do you want to use?</Text>
						<SelectInput
							items={AGENT_CHOICES}
							initialIndex={AGENT_CHOICES.findIndex((choice) => choice.value === state.agentType)}
							onSelect={handleAgentSelect}
						/>
					</Box>
				);

			case "format":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">PRD format:</Text>
						<SelectInput
							items={FORMAT_CHOICES}
							initialIndex={FORMAT_CHOICES.findIndex((choice) => choice.value === state.prdFormat)}
							onSelect={handleFormatSelect}
						/>
					</Box>
				);

			case "description":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Describe what you want to build:</Text>
						<Text dimColor>
							Be as detailed as possible. The AI will break this down into tasks.
						</Text>
						<Box marginTop={1}>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleDescriptionSubmit}
								placeholder="I want to build a..."
							/>
						</Box>
					</Box>
				);

			case "generating":
				return (
					<Box flexDirection="column" gap={1}>
						<Spinner label="Generating PRD from your description..." />
						{state.agentOutput && (
							<Box marginTop={1} flexDirection="column">
								<Text dimColor>Agent output:</Text>
								<Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1}>
									<Text dimColor>{state.agentOutput.slice(-500)}</Text>
								</Box>
							</Box>
						)}
					</Box>
				);

			case "complete": {
				const prdFileName = state.prdFormat === "yaml" ? "prd.yaml" : "prd.json";
				const agentName = state.agentType === "cursor" ? "Cursor" : "Claude Code";

				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">
							Created {RALPH_DIR}/{prdFileName} and {PROGRESS_FILE_PATH}
						</Message>
						<Text>
							<Text dimColor>Project:</Text>{" "}
							<Text color="yellow">{state.generatedPrd?.project}</Text>
						</Text>
						<Text>
							<Text dimColor>Agent:</Text> <Text color="yellow">{agentName}</Text>
						</Text>
						<Text>
							<Text dimColor>Tasks:</Text> <Text>{state.generatedPrd?.tasks.length ?? 0}</Text>
						</Text>
						{state.generatedPrd && state.generatedPrd.tasks.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								<Text dimColor>Generated tasks:</Text>
								{state.generatedPrd.tasks.map((task, index) => (
									<Text key={task.title}>
										<Text dimColor> {index + 1}.</Text> {task.title}
									</Text>
								))}
							</Box>
						)}
						<Box marginTop={1}>
							<Text dimColor>Run 'ralph' to start working on your tasks.</Text>
						</Box>
						<Text dimColor>Press Enter to exit</Text>
					</Box>
				);
			}

			case "error":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="error">Error: {state.errorMessage}</Message>
						<Text dimColor>Press Enter to exit</Text>
					</Box>
				);

			case "aborted":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="warning">Aborted.</Message>
						<Text dimColor>Press Enter to exit</Text>
					</Box>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text bold>Initialize new PRD project</Text>
				</Box>
				{renderStep()}
			</Box>
		</Box>
	);
}
