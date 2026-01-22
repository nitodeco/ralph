import { Box, Text } from "ink";
import { useRef, useState } from "react";
import { match } from "ts-pattern";
import { ResponsiveLayout, useResponsive } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { Header } from "@/components/Header.tsx";
import { runAgentWithPrompt } from "@/lib/agent.ts";
import { loadConfig } from "@/lib/config.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import { applyApprovedCommands, generateDiffFromPrdStates } from "@/lib/plan-command-parser.ts";
import { loadPrd, reloadPrd, savePrd } from "@/lib/prd.ts";
import { buildPlanPrompt } from "@/lib/prompt.ts";
import type { PlanDiffTask, PlanPhase, Prd, PrdTask } from "@/types.ts";
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

function PlanHeader({ version }: { version: string }): React.ReactElement {
	const { isNarrow, isMedium } = useResponsive();
	const headerVariant = isNarrow ? "minimal" : isMedium ? "compact" : "full";

	return <Header version={version} variant={headerVariant} />;
}

function PlanFooter(): React.ReactElement {
	return (
		<Box paddingX={1}>
			<Text dimColor>Press Escape to cancel</Text>
		</Box>
	);
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

	const abortRef = useRef<(() => void) | null>(null);

	const handleSpecificationSubmit = async (specification: string) => {
		const prdBefore = state.existingPrd ? structuredClone(state.existingPrd) : null;

		setState((prev) => ({
			...prev,
			specification,
			phase: "generating",
			agentOutput: "",
		}));

		try {
			const prompt = buildPlanPrompt(specification, state.existingPrd);
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

			await promise;

			abortRef.current = null;

			const prdAfter = reloadPrd();
			const diffTasks = generateDiffFromPrdStates(prdBefore, prdAfter);

			const hasChanges = diffTasks.some((diffTask) => diffTask.status !== "unchanged");

			if (!hasChanges) {
				setState((prev) => ({
					...prev,
					phase: "error",
					errorMessage:
						"No task changes were detected. The agent may not have made any modifications to the PRD.",
				}));

				return;
			}

			setState((prev) => ({
				...prev,
				existingPrd: prdAfter,
				generatedPrd: null,
				diffTasks,
				phase: "review",
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
				phase: "error",
				errorMessage,
			}));
		}
	};

	const handleGenerationCancel = () => {
		if (abortRef.current) {
			abortRef.current();
		}
	};

	const handleAccept = (acceptedIndices: Set<number>, editedTasks: Map<number, PrdTask>) => {
		const finalPrd = applyApprovedCommands(
			state.existingPrd,
			state.diffTasks,
			acceptedIndices,
			editedTasks,
		);

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

	const handleRetry = () => {
		setState((prev) => ({
			...prev,
			phase: "input",
			agentOutput: "",
			errorMessage: null,
		}));
	};

	const renderPhase = (): React.ReactNode =>
		match(state.phase)
			.with("input", () => (
				<PlanInputPhase
					existingPrd={state.existingPrd}
					onSubmit={handleSpecificationSubmit}
					onCancel={handleCancel}
				/>
			))
			.with("generating", () => (
				<PlanGeneratingPhase agentOutput={state.agentOutput} onCancel={handleGenerationCancel} />
			))
			.with("review", () => (
				<PlanReviewPhase
					diffTasks={state.diffTasks}
					onAccept={handleAccept}
					onCancel={handleCancel}
				/>
			))
			.with("complete", () =>
				state.finalPrd ? <PlanCompletePhase prd={state.finalPrd} onClose={handleExit} /> : null,
			)
			.with("error", () => (
				<PlanErrorPhase
					errorMessage={state.errorMessage ?? "Unknown error"}
					onRetry={handleRetry}
					onClose={handleExit}
				/>
			))
			.exhaustive();

	return (
		<ResponsiveLayout
			header={<PlanHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						<Box marginBottom={1}>
							<Text bold>Generate PRD from Specification</Text>
						</Box>
						{renderPhase()}
					</Box>
				</ScrollableContent>
			}
			footer={<PlanFooter />}
			headerHeight={10}
			footerHeight={2}
		/>
	);
}
