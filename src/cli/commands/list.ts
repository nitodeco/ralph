import { loadPrd } from "@/lib/prd.ts";
import type { TaskListOutput } from "@/types.ts";

function getUnmetDependencies(
	task: { dependsOn?: string[] },
	prd: { tasks: Array<{ title: string; done: boolean }> },
): string[] {
	if (!task.dependsOn || task.dependsOn.length === 0) {
		return [];
	}

	const taskTitleMap = new Map<string, boolean>();
	for (const prdTask of prd.tasks) {
		taskTitleMap.set(prdTask.title.toLowerCase(), prdTask.done);
	}

	return task.dependsOn.filter((depTitle) => {
		const isDone = taskTitleMap.get(depTitle.toLowerCase());
		return isDone !== true;
	});
}

export function printList(version: string, jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		if (jsonOutput) {
			console.log(JSON.stringify({ error: "No PRD found" }));
		} else {
			console.log("No PRD found in .ralph/prd.json or .ralph/prd.yaml");
			console.log("\nRun 'ralph init' to create a new PRD.");
		}
		return;
	}

	const completedTasks = prd.tasks.filter((task) => task.done).length;
	const blockedTaskCount = prd.tasks.filter(
		(task) => !task.done && getUnmetDependencies(task, prd).length > 0,
	).length;
	const pendingTasks = prd.tasks.length - completedTasks - blockedTaskCount;
	const percentComplete =
		prd.tasks.length > 0 ? Math.round((completedTasks / prd.tasks.length) * 100) : 0;

	if (jsonOutput) {
		const output: TaskListOutput = {
			project: prd.project,
			tasks: prd.tasks.map((task, taskIndex) => {
				const unmetDeps = getUnmetDependencies(task, prd);
				let status: "done" | "pending" | "blocked";
				if (task.done) {
					status = "done";
				} else if (unmetDeps.length > 0) {
					status = "blocked";
				} else {
					status = "pending";
				}
				return {
					index: taskIndex + 1,
					title: task.title,
					description: task.description,
					status,
					steps: task.steps,
					dependsOn: task.dependsOn,
					blockedBy: unmetDeps.length > 0 ? unmetDeps : undefined,
				};
			}),
			summary: {
				total: prd.tasks.length,
				completed: completedTasks,
				pending: pendingTasks,
				blocked: blockedTaskCount,
				percentComplete,
			},
		};
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	console.log(`◆ ralph v${version} - Task List\n`);
	console.log(`Project: ${prd.project}`);
	console.log(`Progress: ${completedTasks}/${prd.tasks.length} tasks (${percentComplete}%)\n`);

	if (prd.tasks.length === 0) {
		console.log("No tasks defined.");
		console.log("\nRun 'ralph init' to add tasks or use '/add' in the UI.");
		return;
	}

	console.log("Tasks:");
	console.log("─".repeat(70));

	for (const [taskIndex, task] of prd.tasks.entries()) {
		const unmetDeps = getUnmetDependencies(task, prd);
		const isBlocked = !task.done && unmetDeps.length > 0;

		let statusIcon: string;
		let statusLabel: string;
		let dimStyle = "";
		const resetStyle = "\x1b[0m";

		if (task.done) {
			statusIcon = "✓";
			statusLabel = "done";
			dimStyle = "\x1b[2m";
		} else if (isBlocked) {
			statusIcon = "⊘";
			statusLabel = "blocked";
			dimStyle = "\x1b[33m";
		} else {
			statusIcon = "○";
			statusLabel = "pending";
		}

		console.log(
			`${dimStyle}${statusIcon} [${taskIndex + 1}] ${task.title} (${statusLabel})${resetStyle}`,
		);

		if (task.dependsOn && task.dependsOn.length > 0) {
			const depsDisplay = task.dependsOn
				.map((depTitle) => {
					const depTask = prd.tasks.find(
						(prdTask) => prdTask.title.toLowerCase() === depTitle.toLowerCase(),
					);
					const depIcon = depTask?.done ? "✓" : "○";
					return `${depIcon} ${depTitle}`;
				})
				.join(", ");
			console.log(`   └─ depends on: ${depsDisplay}`);
		}
	}

	console.log("─".repeat(70));

	const summaryParts = [`${completedTasks} completed`];
	if (pendingTasks > 0) {
		summaryParts.push(`${pendingTasks} ready`);
	}
	if (blockedTaskCount > 0) {
		summaryParts.push(`${blockedTaskCount} blocked`);
	}
	console.log(`\nSummary: ${summaryParts.join(", ")}`);

	if (pendingTasks > 0 || blockedTaskCount > 0) {
		const nextTask = prd.tasks.find(
			(task) => !task.done && getUnmetDependencies(task, prd).length === 0,
		);
		if (nextTask) {
			console.log(`\nNext task: ${nextTask.title}`);
		} else if (blockedTaskCount > 0) {
			console.log("\nNo tasks ready - all pending tasks are blocked by dependencies.");
		}
	} else if (completedTasks === prd.tasks.length) {
		console.log("\nAll tasks complete!");
	}
}
