import { loadPrd } from "@/lib/prd.ts";
import type { TaskListOutput } from "@/types.ts";

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
	const pendingTasks = prd.tasks.length - completedTasks;
	const percentComplete =
		prd.tasks.length > 0 ? Math.round((completedTasks / prd.tasks.length) * 100) : 0;

	if (jsonOutput) {
		const output: TaskListOutput = {
			project: prd.project,
			tasks: prd.tasks.map((task, taskIndex) => {
				return {
					index: taskIndex + 1,
					title: task.title,
					description: task.description,
					status: task.done ? "done" : "pending",
					steps: task.steps,
				};
			}),
			summary: {
				total: prd.tasks.length,
				completed: completedTasks,
				pending: pendingTasks,
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
		let statusIcon: string;
		let statusLabel: string;
		let dimStyle = "";
		const resetStyle = "\x1b[0m";

		if (task.done) {
			statusIcon = "✓";
			statusLabel = "done";
			dimStyle = "\x1b[2m";
		} else {
			statusIcon = "○";
			statusLabel = "pending";
		}

		console.log(
			`${dimStyle}${statusIcon} [${taskIndex + 1}] ${task.title} (${statusLabel})${resetStyle}`,
		);
	}

	console.log("─".repeat(70));

	const summaryParts = [`${completedTasks} completed`];
	if (pendingTasks > 0) {
		summaryParts.push(`${pendingTasks} pending`);
	}
	console.log(`\nSummary: ${summaryParts.join(", ")}`);

	if (pendingTasks > 0) {
		const nextTask = prd.tasks.find((task) => !task.done);
		if (nextTask) {
			console.log(`\nNext task: ${nextTask.title}`);
		}
	} else if (completedTasks === prd.tasks.length) {
		console.log("\nAll tasks complete!");
	}
}
