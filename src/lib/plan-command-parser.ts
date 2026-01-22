import type { PlanDiffTask, Prd, PrdTask } from "@/types.ts";

function tasksAreEqual(taskA: PrdTask, taskB: PrdTask): boolean {
	if (taskA.title !== taskB.title) {
		return false;
	}

	if (taskA.description !== taskB.description) {
		return false;
	}

	if (taskA.steps.length !== taskB.steps.length) {
		return false;
	}

	return taskA.steps.every((step, stepIndex) => step === taskB.steps.at(stepIndex));
}

export function generateDiffFromPrdStates(before: Prd | null, after: Prd | null): PlanDiffTask[] {
	const beforeTasks = before?.tasks ?? [];
	const afterTasks = after?.tasks ?? [];
	const diffTasks: PlanDiffTask[] = [];

	const beforeTaskByTitle = new Map<string, { task: PrdTask; index: number }>();

	for (let taskIndex = 0; taskIndex < beforeTasks.length; taskIndex++) {
		const task = beforeTasks.at(taskIndex);

		if (task) {
			beforeTaskByTitle.set(task.title, { task, index: taskIndex });
		}
	}

	const matchedBeforeIndices = new Set<number>();

	for (const afterTask of afterTasks) {
		const maybeBeforeEntry = beforeTaskByTitle.get(afterTask.title);

		if (maybeBeforeEntry) {
			matchedBeforeIndices.add(maybeBeforeEntry.index);

			if (tasksAreEqual(maybeBeforeEntry.task, afterTask)) {
				diffTasks.push({
					task: afterTask,
					status: "unchanged",
				});
			} else {
				diffTasks.push({
					task: afterTask,
					status: "modified",
					originalTask: maybeBeforeEntry.task,
				});
			}
		} else {
			diffTasks.push({
				task: afterTask,
				status: "new",
			});
		}
	}

	for (let taskIndex = 0; taskIndex < beforeTasks.length; taskIndex++) {
		if (!matchedBeforeIndices.has(taskIndex)) {
			const removedTask = beforeTasks.at(taskIndex);

			if (removedTask) {
				diffTasks.push({
					task: removedTask,
					status: "removed",
					originalTask: removedTask,
				});
			}
		}
	}

	return diffTasks;
}

export function applyApprovedCommands(
	existingPrd: Prd | null,
	diffTasks: PlanDiffTask[],
	acceptedIndices: Set<number>,
	editedTasks?: Map<number, PrdTask>,
): Prd {
	const projectName = existingPrd?.project ?? "Untitled Project";
	const tasks: PrdTask[] = [];

	for (let diffIndex = 0; diffIndex < diffTasks.length; diffIndex++) {
		const diffTask = diffTasks.at(diffIndex);

		if (!diffTask) {
			continue;
		}

		const isAccepted = acceptedIndices.has(diffIndex);
		const maybeEditedTask = editedTasks?.get(diffIndex);

		if (diffTask.status === "removed") {
			if (!isAccepted && diffTask.originalTask) {
				tasks.push(maybeEditedTask ?? diffTask.originalTask);
			}
		} else if (diffTask.status === "modified") {
			if (isAccepted) {
				tasks.push(maybeEditedTask ?? diffTask.task);
			} else if (diffTask.originalTask) {
				tasks.push(maybeEditedTask ?? diffTask.originalTask);
			}
		} else if (diffTask.status === "new") {
			if (isAccepted) {
				tasks.push(maybeEditedTask ?? diffTask.task);
			}
		} else if (diffTask.status === "unchanged") {
			tasks.push(maybeEditedTask ?? diffTask.task);
		}
	}

	return {
		project: projectName,
		tasks,
	};
}
