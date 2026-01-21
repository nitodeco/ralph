import { PLAN_OUTPUT_END, PLAN_OUTPUT_START } from "@/lib/prompt.ts";
import { isPrd, type Prd, type PrdTask } from "@/lib/services/index.ts";
import type { PlanDiffTask } from "@/types.ts";

const WORD_OVERLAP_THRESHOLD = 0.6;

function getWords(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.split(/\s+/)
		.filter((word) => word.length > 0);
}

function computeTitleSimilarity(title1: string, title2: string): number {
	const words1 = getWords(title1);
	const words2 = getWords(title2);

	if (words1.length === 0 || words2.length === 0) {
		return 0;
	}

	const set1 = new Set(words1);
	const set2 = new Set(words2);

	const intersection = words1.filter((word) => set2.has(word)).length;
	const smallerSize = Math.min(set1.size, set2.size);

	return intersection / smallerSize;
}

function areTasksEqual(task1: PrdTask, task2: PrdTask): boolean {
	if (task1.description !== task2.description) {
		return false;
	}

	if (task1.steps.length !== task2.steps.length) {
		return false;
	}

	return task1.steps.every((step, index) => step === task2.steps.at(index));
}

export function parsePlanFromOutput(output: string): Prd | null {
	const startIndex = output.indexOf(PLAN_OUTPUT_START);
	const endIndex = output.indexOf(PLAN_OUTPUT_END);

	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		return null;
	}

	const prdContent = output.slice(startIndex + PLAN_OUTPUT_START.length, endIndex).trim();

	try {
		const parsed: unknown = JSON.parse(prdContent);

		if (!isPrd(parsed)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

export function computeTaskDiff(existingPrd: Prd | null, generatedPrd: Prd): PlanDiffTask[] {
	const diffTasks: PlanDiffTask[] = [];
	const matchedExistingIndices = new Set<number>();

	for (const generatedTask of generatedPrd.tasks) {
		let bestMatchIndex = -1;
		let bestMatchSimilarity = 0;

		if (existingPrd) {
			for (let taskIndex = 0; taskIndex < existingPrd.tasks.length; taskIndex++) {
				if (matchedExistingIndices.has(taskIndex)) {
					continue;
				}

				const existingTask = existingPrd.tasks.at(taskIndex);

				if (!existingTask) {
					continue;
				}

				const similarity = computeTitleSimilarity(generatedTask.title, existingTask.title);

				if (similarity > bestMatchSimilarity && similarity >= WORD_OVERLAP_THRESHOLD) {
					bestMatchSimilarity = similarity;
					bestMatchIndex = taskIndex;
				}
			}
		}

		if (bestMatchIndex >= 0 && existingPrd) {
			matchedExistingIndices.add(bestMatchIndex);
			const existingTask = existingPrd.tasks.at(bestMatchIndex);

			if (existingTask) {
				const taskWithDoneStatus: PrdTask = {
					...generatedTask,
					done: existingTask.done,
				};

				if (areTasksEqual(existingTask, taskWithDoneStatus)) {
					diffTasks.push({
						task: existingTask,
						status: "unchanged",
					});
				} else {
					diffTasks.push({
						task: taskWithDoneStatus,
						status: "modified",
						originalTask: existingTask,
					});
				}
			}
		} else {
			diffTasks.push({
				task: generatedTask,
				status: "new",
			});
		}
	}

	if (existingPrd) {
		for (let taskIndex = 0; taskIndex < existingPrd.tasks.length; taskIndex++) {
			if (!matchedExistingIndices.has(taskIndex)) {
				const existingTask = existingPrd.tasks.at(taskIndex);

				if (existingTask) {
					diffTasks.push({
						task: existingTask,
						status: "removed",
						originalTask: existingTask,
					});
				}
			}
		}
	}

	return diffTasks;
}

export function applyDiffToPrd(
	existingPrd: Prd | null,
	diffTasks: PlanDiffTask[],
	projectName: string,
	acceptedIndices: Set<number>,
): Prd {
	const tasks: PrdTask[] = [];

	for (let taskIndex = 0; taskIndex < diffTasks.length; taskIndex++) {
		const diffTask = diffTasks.at(taskIndex);

		if (!diffTask) {
			continue;
		}

		const isAccepted = acceptedIndices.has(taskIndex);

		if (diffTask.status === "removed") {
			if (isAccepted && diffTask.originalTask) {
				continue;
			}

			if (!isAccepted && diffTask.originalTask) {
				tasks.push(diffTask.originalTask);
			}
		} else if (diffTask.status === "modified") {
			if (isAccepted) {
				tasks.push(diffTask.task);
			} else if (diffTask.originalTask) {
				tasks.push(diffTask.originalTask);
			}
		} else if (isAccepted) {
			tasks.push(diffTask.task);
		}
	}

	return {
		project: existingPrd?.project ?? projectName,
		tasks,
	};
}
