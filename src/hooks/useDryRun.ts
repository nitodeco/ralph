import { useEffect, useState } from "react";
import { validateConfig } from "@/lib/config.ts";
import {
	DRY_RUN_CONFIG_VALIDATION_DELAY_MS,
	DRY_RUN_ITERATION_DELAY_MS,
	DRY_RUN_PRD_LOAD_DELAY_MS,
	DRY_RUN_SEPARATOR_WIDTH,
	DRY_RUN_TASK_DELAY_MS,
} from "@/lib/constants/ui.ts";
import { isGitRepository } from "@/lib/paths.ts";
import { loadPrd } from "@/lib/prd.ts";
import type { Prd, PrdTask, RalphConfig } from "@/types.ts";

function getNextPendingTask(prd: Prd): PrdTask | null {
	return prd.tasks.find((task) => !task.done) ?? null;
}

export interface DryRunState {
	status: "idle" | "validating" | "simulating" | "complete";
	currentIteration: number;
	logs: string[];
	errors: string[];
	warnings: string[];
}

const INITIAL_DRY_RUN_STATE: DryRunState = {
	status: "idle",
	currentIteration: 0,
	logs: [],
	errors: [],
	warnings: [],
};

export function useDryRun(
	enabled: boolean,
	config: RalphConfig | null,
	iterations: number,
): DryRunState {
	const [state, setState] = useState<DryRunState>(INITIAL_DRY_RUN_STATE);

	useEffect(() => {
		if (!enabled || state.status !== "idle") {
			return;
		}

		const runDryRunSimulation = async () => {
			const logs: string[] = [];
			const errors: string[] = [];
			const warnings: string[] = [];

			setState((prev) => ({
				...prev,
				status: "validating",
				logs: ["Validating configuration..."],
			}));

			await new Promise((resolve) => setTimeout(resolve, DRY_RUN_CONFIG_VALIDATION_DELAY_MS));

			if (config) {
				const validation = validateConfig(config);

				if (!validation.valid) {
					for (const error of validation.errors) {
						errors.push(`Config error: ${error.field} - ${error.message}`);
					}
				}

				for (const warning of validation.warnings) {
					warnings.push(`Config warning: ${warning.field} - ${warning.message}`);
				}

				logs.push(`Configuration validated (agent: ${config.agent})`);
			} else {
				errors.push("No configuration found. Run 'ralph setup' first.");
			}

			await new Promise((resolve) => setTimeout(resolve, DRY_RUN_PRD_LOAD_DELAY_MS));

			const currentPrd = loadPrd();

			if (currentPrd) {
				logs.push(`PRD loaded: "${currentPrd.project}"`);
				logs.push(`Total tasks: ${currentPrd.tasks.length}`);
				const completedCount = currentPrd.tasks.filter((task) => task.done).length;
				const pendingCount = currentPrd.tasks.length - completedCount;

				logs.push(`Completed: ${completedCount}, Pending: ${pendingCount}`);
			} else {
				errors.push("No PRD found. Run 'ralph init' first.");
			}

			if (!isGitRepository()) {
				warnings.push(
					"Not in a git repository. Commits will be skipped. Initialize git with 'git init' if you want automatic commits.",
				);
			}

			setState((prev) => ({
				...prev,
				logs: [...logs],
				errors: [...errors],
				warnings: [...warnings],
			}));

			if (errors.length > 0) {
				setState((prev) => ({ ...prev, status: "complete" }));

				return;
			}

			setState((prev) => ({ ...prev, status: "simulating" }));

			const prdForSimulation = currentPrd;

			if (!prdForSimulation) {
				setState((prev) => ({ ...prev, status: "complete" }));

				return;
			}

			const simulationIterations = Math.min(
				iterations,
				prdForSimulation.tasks.filter((task) => !task.done).length,
			);

			logs.push(`\nSimulating ${simulationIterations} iteration(s)...`);
			logs.push("─".repeat(DRY_RUN_SEPARATOR_WIDTH));

			for (let iterationIndex = 1; iterationIndex <= simulationIterations; iterationIndex++) {
				setState((prev) => ({
					...prev,
					currentIteration: iterationIndex,
					logs: [...prev.logs, `\n[Iteration ${iterationIndex}/${simulationIterations}]`],
				}));

				await new Promise((resolve) => setTimeout(resolve, DRY_RUN_ITERATION_DELAY_MS));

				const nextTask = getNextPendingTask(prdForSimulation);

				if (nextTask) {
					setState((prev) => ({
						...prev,
						logs: [...prev.logs, `  → Would work on: "${nextTask.title}"`],
					}));

					await new Promise((resolve) => setTimeout(resolve, DRY_RUN_TASK_DELAY_MS));

					setState((prev) => ({
						...prev,
						logs: [
							...prev.logs,
							`  → Agent (${config?.agent ?? "cursor"}) would execute with prompt`,
							`  → Steps: ${nextTask.steps.length} defined`,
						],
					}));

					await new Promise((resolve) => setTimeout(resolve, DRY_RUN_TASK_DELAY_MS));

					setState((prev) => ({
						...prev,
						logs: [...prev.logs, `  ✓ Simulated completion`],
					}));

					nextTask.done = true;
				} else {
					setState((prev) => ({
						...prev,
						logs: [...prev.logs, `  → No pending tasks remaining`],
					}));
					break;
				}
			}

			setState((prev) => ({
				...prev,
				status: "complete",
				logs: [
					...prev.logs,
					`\n${"─".repeat(DRY_RUN_SEPARATOR_WIDTH)}`,
					"Dry-run simulation complete.",
					"No changes were made to your project.",
				],
			}));
		};

		runDryRunSimulation();
	}, [enabled, state.status, config, iterations]);

	return state;
}
