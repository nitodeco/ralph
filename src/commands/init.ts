import { existsSync, writeFileSync } from "node:fs";
import { confirm, editor, input } from "@inquirer/prompts";
import { findPrdFile, savePrd } from "../lib/prd.ts";
import type { Prd, PrdTask } from "../types.ts";

export async function initCommand(): Promise<void> {
	const existingPrd = findPrdFile();
	if (existingPrd) {
		const overwrite = await confirm({
			message: `A PRD file already exists (${existingPrd}). Overwrite it?`,
			default: false,
		});

		if (!overwrite) {
			console.log("Aborted.");
			return;
		}
	}

	if (existsSync("progress.txt")) {
		const overwriteProgress = await confirm({
			message: "progress.txt already exists. Overwrite it?",
			default: false,
		});

		if (!overwriteProgress) {
			console.log("Aborted.");
			return;
		}
	}

	const projectName = await input({
		message: "Project name:",
		default: process.cwd().split("/").pop() ?? "my-project",
	});

	const format = await confirm({
		message: "Use YAML format? (No = JSON)",
		default: false,
	});

	const tasks: PrdTask[] = [];
	let addMoreTasks = true;

	console.log("\nLet's add some tasks to your PRD.\n");

	while (addMoreTasks) {
		const taskTitle = await input({
			message: "Task title (leave empty to finish):",
		});

		if (!taskTitle.trim()) {
			break;
		}

		const taskDescription = await input({
			message: "Task description:",
			default: "",
		});

		const stepsInput = await editor({
			message: "Enter steps (one per line):",
			default: "",
		});

		const steps = stepsInput
			.split("\n")
			.map((step) => step.trim())
			.filter((step) => step.length > 0);

		tasks.push({
			title: taskTitle,
			description: taskDescription,
			steps,
			done: false,
		});

		console.log(`\nAdded task: "${taskTitle}"\n`);

		addMoreTasks = await confirm({
			message: "Add another task?",
			default: true,
		});
	}

	const prd: Prd = {
		project: projectName,
		tasks,
	};

	savePrd(prd, format ? "yaml" : "json");
	writeFileSync("progress.txt", "");

	const prdFileName = format ? "prd.yaml" : "prd.json";
	console.log(`\nCreated ${prdFileName} and progress.txt`);
	console.log(`\nRun 'ralph run' to start working on your tasks.`);
}
