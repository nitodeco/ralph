import { analyzePatterns, recordFailure } from "@/lib/failure-patterns.ts";
import { getLogger } from "@/lib/logger.ts";
import { getSessionMemoryService } from "@/lib/services/index.ts";
import type { IterationLogRetryContext } from "@/types.ts";

interface LearningHandlerOptions {
	enabled: boolean;
	logFilePath?: string;
}

interface IterationOutcomeParams {
	iteration: number;
	wasSuccessful: boolean;
	agentError: string | null;
	output: string;
	exitCode: number | null;
	taskTitle: string;
	retryCount: number;
	retryContexts: IterationLogRetryContext[];
	verificationFailed: boolean;
	failedChecks: string[];
}

export class LearningHandler {
	private enabled: boolean;
	private logFilePath: string | undefined;

	constructor(options: LearningHandlerOptions) {
		this.enabled = options.enabled;
		this.logFilePath = options.logFilePath;
	}

	recordIterationOutcome(params: IterationOutcomeParams): void {
		if (!this.enabled) {
			return;
		}

		const logger = getLogger({ logFilePath: this.logFilePath });
		const shouldRecordFailure = Boolean(params.agentError) || params.verificationFailed;

		if (shouldRecordFailure) {
			const errorMessage = params.agentError ?? "Verification failed";

			recordFailure({
				error: errorMessage,
				output: params.output,
				taskTitle: params.taskTitle,
				exitCode: params.exitCode,
				iteration: params.iteration,
			});

			const patterns = analyzePatterns();
			const significantPatterns = patterns.filter((pattern) => pattern.occurrences >= 3);

			if (significantPatterns.length > 0) {
				logger.info("Recurring failure patterns detected", {
					patternCount: significantPatterns.length,
					topPattern: significantPatterns[0]?.category,
				});
			}

			if (params.verificationFailed && params.failedChecks.length > 0) {
				const sessionMemoryService = getSessionMemoryService();

				sessionMemoryService.addFailedApproach(
					`Verification failed: ${params.failedChecks.join(", ")}`,
				);
			}
		}

		if (params.wasSuccessful && params.retryCount > 0 && params.retryContexts.length > 0) {
			const lastContext = params.retryContexts[params.retryContexts.length - 1];

			if (lastContext) {
				const sessionMemoryService = getSessionMemoryService();

				sessionMemoryService.addLesson(
					`Task "${params.taskTitle}" succeeded after retry: ${lastContext.rootCause} was resolved`,
				);
				sessionMemoryService.addSuccessPattern(
					`Recovered from ${lastContext.failureCategory} by addressing: ${lastContext.rootCause}`,
				);
			}
		}

		if (params.wasSuccessful) {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.addSuccessPattern(`Completed task: ${params.taskTitle}`);
		}
	}
}
