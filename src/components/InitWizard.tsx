import { Box, Text, useApp, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { existsSync, writeFileSync } from "node:fs";
import { useState } from "react";
import { loadGlobalConfig, saveConfig } from "../lib/config.ts";
import {
	ensureRalphDirExists,
	findPrdFile,
	PROGRESS_FILE_PATH,
	RALPH_DIR,
	savePrd,
} from "../lib/prd.ts";
import type { AgentType, Prd, PrdTask, RalphConfig } from "../types.ts";
import { Header } from "./Header.tsx";
import { Message } from "./common/Message.tsx";

interface InitWizardProps {
	version: string;
}

type WizardStep =
	| "check_existing_prd"
	| "check_existing_progress"
	| "project_name"
	| "agent_type"
	| "format"
	| "task_title"
	| "task_description"
	| "task_steps"
	| "add_more_tasks"
	| "complete"
	| "aborted";

interface WizardState {
	step: WizardStep;
	projectName: string;
	agentType: AgentType;
	useYaml: boolean;
	tasks: PrdTask[];
	currentTask: Partial<PrdTask>;
	existingPrdPath: string | null;
	existingProgressPath: boolean;
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
	{ label: "JSON", value: false },
	{ label: "YAML", value: true },
];

function getDefaultProjectName(): string {
	return process.cwd().split("/").pop() ?? "my-project";
}

export function InitWizard({ version }: InitWizardProps): React.ReactElement {
	const { exit } = useApp();

	const existingPrd = findPrdFile();
	const existingProgress = existsSync(PROGRESS_FILE_PATH);
	const globalConfig = loadGlobalConfig();

	const getInitialStep = (): WizardStep => {
		if (existingPrd) return "check_existing_prd";
		if (existingProgress) return "check_existing_progress";
		return "project_name";
	};

	const [state, setState] = useState<WizardState>({
		step: getInitialStep(),
		projectName: getDefaultProjectName(),
		agentType: globalConfig.agent,
		useYaml: globalConfig.prdFormat === "yaml",
		tasks: [],
		currentTask: {},
		existingPrdPath: existingPrd,
		existingProgressPath: existingProgress,
	});

	const [inputValue, setInputValue] = useState(
		state.step === "project_name" ? getDefaultProjectName() : "",
	);

	const handleConfirmOverwritePrd = (item: { value: boolean }) => {
		if (!item.value) {
			setState((prev) => ({ ...prev, step: "aborted" }));
			return;
		}
		if (state.existingProgressPath) {
			setState((prev) => ({ ...prev, step: "check_existing_progress" }));
		} else {
			setState((prev) => ({ ...prev, step: "project_name" }));
		}
	};

	const handleConfirmOverwriteProgress = (item: { value: boolean }) => {
		if (!item.value) {
			setState((prev) => ({ ...prev, step: "aborted" }));
			return;
		}
		setState((prev) => ({ ...prev, step: "project_name" }));
	};

	const handleProjectNameSubmit = (value: string) => {
		const name = value.trim() || getDefaultProjectName();
		setState((prev) => ({ ...prev, projectName: name, step: "agent_type" }));
	};

	const handleAgentSelect = (item: { value: AgentType }) => {
		setState((prev) => ({ ...prev, agentType: item.value, step: "format" }));
	};

	const handleFormatSelect = (item: { value: boolean }) => {
		setState((prev) => ({ ...prev, useYaml: item.value, step: "task_title" }));
		setInputValue("");
	};

	const handleTaskTitleSubmit = (value: string) => {
		const title = value.trim();
		if (!title) {
			finishWizard();
			return;
		}
		setState((prev) => ({
			...prev,
			currentTask: { title, done: false },
			step: "task_description",
		}));
		setInputValue("");
	};

	const handleTaskDescriptionSubmit = (value: string) => {
		setState((prev) => ({
			...prev,
			currentTask: { ...prev.currentTask, description: value.trim() },
			step: "task_steps",
		}));
		setInputValue("");
	};

	const handleTaskStepsSubmit = (value: string) => {
		const steps = value
			.split("\n")
			.map((step) => step.trim())
			.filter((step) => step.length > 0);

		const newTask: PrdTask = {
			title: state.currentTask.title ?? "",
			description: state.currentTask.description ?? "",
			steps,
			done: false,
		};

		setState((prev) => ({
			...prev,
			tasks: [...prev.tasks, newTask],
			currentTask: {},
			step: "add_more_tasks",
		}));
		setInputValue("");
	};

	const handleAddMoreTasks = (item: { value: boolean }) => {
		if (item.value) {
			setState((prev) => ({ ...prev, step: "task_title" }));
			setInputValue("");
		} else {
			finishWizard();
		}
	};

	const finishWizard = () => {
		const prd: Prd = {
			project: state.projectName,
			tasks: state.tasks,
		};

		ensureRalphDirExists();
		savePrd(prd, state.useYaml ? "yaml" : "json");
		writeFileSync(PROGRESS_FILE_PATH, "");

		const config: RalphConfig = { agent: state.agentType };
		saveConfig(config);

		setState((prev) => ({ ...prev, step: "complete" }));
	};

	useInput((_, key) => {
		if (state.step === "complete" || state.step === "aborted") {
			if (key.return || key.escape) {
				exit();
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
						<Text color="yellow">
							{PROGRESS_FILE_PATH} already exists. Overwrite it?
						</Text>
						<SelectInput items={YES_NO_CHOICES} onSelect={handleConfirmOverwriteProgress} />
					</Box>
				);

			case "project_name":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Project name:</Text>
						<Box>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleProjectNameSubmit}
								placeholder={getDefaultProjectName()}
							/>
						</Box>
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
							initialIndex={FORMAT_CHOICES.findIndex((choice) => choice.value === state.useYaml)}
							onSelect={handleFormatSelect}
						/>
					</Box>
				);

			case "task_title":
				return (
					<Box flexDirection="column" gap={1}>
						{state.tasks.length === 0 && (
							<Text dimColor>Let's add some tasks to your PRD.</Text>
						)}
						<Text color="cyan">Task title (leave empty to finish):</Text>
						<Box>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleTaskTitleSubmit}
							/>
						</Box>
					</Box>
				);

			case "task_description":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Task description:</Text>
						<Box>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleTaskDescriptionSubmit}
							/>
						</Box>
					</Box>
				);

			case "task_steps":
				return (
					<Box flexDirection="column" gap={1}>
						<Text color="cyan">Enter steps (comma-separated):</Text>
						<Box>
							<Text color="green">❯ </Text>
							<TextInput
								value={inputValue}
								onChange={setInputValue}
								onSubmit={handleTaskStepsSubmit}
							/>
						</Box>
						<Text dimColor>Example: Step 1, Step 2, Step 3</Text>
					</Box>
				);

			case "add_more_tasks":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">Added task: "{state.tasks[state.tasks.length - 1]?.title}"</Message>
						<Text color="cyan">Add another task?</Text>
						<SelectInput items={YES_NO_CHOICES} onSelect={handleAddMoreTasks} />
					</Box>
				);

			case "complete": {
				const prdFileName = state.useYaml ? "prd.yaml" : "prd.json";
				const agentName = state.agentType === "cursor" ? "Cursor" : "Claude Code";
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">
							Created {RALPH_DIR}/{prdFileName} and {PROGRESS_FILE_PATH}
						</Message>
						<Text>
							<Text dimColor>Agent:</Text> <Text color="yellow">{agentName}</Text>
						</Text>
						<Text>
							<Text dimColor>Tasks:</Text> <Text>{state.tasks.length}</Text>
						</Text>
						<Box marginTop={1}>
							<Text dimColor>Run 'ralph run' to start working on your tasks.</Text>
						</Box>
						<Text dimColor>Press Enter to exit</Text>
					</Box>
				);
			}

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
