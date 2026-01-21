import { Box, Text } from "ink";
import { useState } from "react";
import { Header } from "@/components/Header.tsx";
import { runAgentWithPrompt } from "@/lib/agent.ts";
import { loadConfig } from "@/lib/config.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import { applyDiffToPrd, computeTaskDiff, parsePlanFromOutput } from "@/lib/plan-parser.ts";
import { loadPrd, savePrd } from "@/lib/prd.ts";
import { buildPlanPrompt } from "@/lib/prompt.ts";
import type { PlanDiffTask, PlanPhase, Prd } from "@/types.ts";
import {
	PlanCompletePhase,
	PlanErrorPhase,
	PlanGeneratingPhase,
	PlanInputPhase,
	PlanReviewPhase,
} from "./plan/index.ts";

interface PlanViewProps {
	version: string;
	onClose: () => void;
}

interface PlanState {
	phase: PlanPhase;
	specification: string;
	existingPrd: Prd | null;
	generatedPrd: Prd | null;
	diffTasks: PlanDiffTask[];
	finalPrd: Prd | null;
	agentOutput: string;
	errorMessage: string | null;
}

export function PlanView({ version, onClose }: PlanViewProps): React.ReactElement {
	const handleExit = () => {
		onClose();
	};

	const existingPrd = loadPrd();
	const config = loadConfig();

	const [state, setState] = useState<PlanState>({
		phase: "input",
		specification: "",
		existingPrd,
		generatedPrd: null,
		diffTasks: [],
		finalPrd: null,
		agentOutput: "",
		errorMessage: null,
	});

	const handleSpecificationSubmit = async (specification: string) => {
		setState((prev) => ({
			...prev,
			specification,
			phase: "generating",
			agentOutput: "",
		}));

		try {
			const prompt = buildPlanPrompt(specification, state.existingPrd);
			const output = await runAgentWithPrompt({
				prompt,
				agentType: config.agent,
				onOutput: (chunk) => {
					setState((prev) => ({
						...prev,
						agentOutput: prev.agentOutput + chunk,
					}));
				},
			});

			const generatedPrd = parsePlanFromOutput(output);

			if (!generatedPrd) {
				setState((prev) => ({
					...prev,
					phase: "error",
					errorMessage:
						"Failed to parse PRD from agent output. The agent may not have followed the expected format.",
				}));

				return;
			}

			const diffTasks = computeTaskDiff(state.existingPrd, generatedPrd);

			setState((prev) => ({
				...prev,
				generatedPrd,
				diffTasks,
				phase: "review",
			}));
		} catch (error) {
			const errorMessage = getErrorMessage(error);

			setState((prev) => ({
				...prev,
				phase: "error",
				errorMessage,
			}));
		}
	};

	const handleAccept = () => {
		const projectName = state.generatedPrd?.project ?? "Untitled Project";
		const finalPrd = applyDiffToPrd(state.existingPrd, state.diffTasks, projectName);

		savePrd(finalPrd);

		setState((prev) => ({
			...prev,
			finalPrd,
			phase: "complete",
		}));
	};

	const handleCancel = () => {
		handleExit();
	};

	const renderPhase = () => {
		switch (state.phase) {
			case "input":
				return (
					<PlanInputPhase existingPrd={state.existingPrd} onSubmit={handleSpecificationSubmit} />
				);

			case "generating":
				return <PlanGeneratingPhase agentOutput={state.agentOutput} />;

			case "review":
				return (
					<PlanReviewPhase
						diffTasks={state.diffTasks}
						onAccept={handleAccept}
						onCancel={handleCancel}
					/>
				);

			case "complete":
				return state.finalPrd ? (
					<PlanCompletePhase prd={state.finalPrd} onClose={handleExit} />
				) : null;

			case "error":
				return (
					<PlanErrorPhase
						errorMessage={state.errorMessage ?? "Unknown error"}
						onClose={handleExit}
					/>
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
					<Text bold>Generate PRD from Specification</Text>
				</Box>
				{renderPhase()}
			</Box>
		</Box>
	);
}
