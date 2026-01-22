import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { applyDecomposition, formatDecompositionForProgress } from "@/lib/decomposition.ts";
import { getLogger } from "@/lib/logger.ts";
import { savePrd } from "@/lib/prd.ts";
import { appendProgress } from "@/lib/progress.ts";
import type { DecompositionRequest, Prd, RalphConfig } from "@/types.ts";
import type { PrdUpdateCallback, RestartIterationCallback } from "./types.ts";

interface DecompositionHandlerOptions {
	config: RalphConfig;
	onPrdUpdate: PrdUpdateCallback;
	onRestartIteration: RestartIterationCallback;
}

export class DecompositionHandler {
	private config: RalphConfig;
	private decompositionCountByTask = new Map<string, number>();
	private onPrdUpdate: PrdUpdateCallback;
	private onRestartIteration: RestartIterationCallback;

	constructor(options: DecompositionHandlerOptions) {
		this.config = options.config;
		this.onPrdUpdate = options.onPrdUpdate;
		this.onRestartIteration = options.onRestartIteration;
	}

	reset(): void {
		this.decompositionCountByTask = new Map();
	}

	handle(request: DecompositionRequest, currentPrd: Prd | null): boolean {
		const logger = getLogger({ logFilePath: this.config.logFilePath });
		const maxDecompositions =
			this.config.maxDecompositionsPerTask ?? DEFAULTS.maxDecompositionsPerTask;
		const taskKey = request.originalTaskTitle.toLowerCase();
		const currentCount = this.decompositionCountByTask.get(taskKey) ?? 0;

		if (currentCount >= maxDecompositions) {
			logger.warn("Max decompositions reached for task, proceeding without decomposition", {
				task: request.originalTaskTitle,
				maxDecompositions,
				currentCount,
			});

			return false;
		}

		if (!currentPrd) {
			logger.error("Cannot apply decomposition: PRD not found");

			return false;
		}

		const decompositionResult = applyDecomposition(currentPrd, request);

		if (!decompositionResult.success || !decompositionResult.updatedPrd) {
			logger.error("Failed to apply decomposition", { error: decompositionResult.error });

			return false;
		}

		savePrd(decompositionResult.updatedPrd);
		this.decompositionCountByTask.set(taskKey, currentCount + 1);

		logger.info("Task decomposed successfully", {
			originalTask: request.originalTaskTitle,
			subtasksCreated: decompositionResult.subtasksCreated,
			reason: request.reason,
		});

		appendProgress(formatDecompositionForProgress(request));

		this.onPrdUpdate(decompositionResult.updatedPrd);
		this.onRestartIteration();

		return true;
	}
}
