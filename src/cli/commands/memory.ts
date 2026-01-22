import * as readline from "node:readline";
import { getSessionMemoryService } from "@/lib/services/index.ts";

export function printMemory(json: boolean): void {
	const sessionMemoryService = getSessionMemoryService();

	if (!sessionMemoryService.exists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No session memory found" }));
		} else {
			console.log("No session memory found. Memory is created automatically during sessions.");
		}

		return;
	}

	const memory = sessionMemoryService.get();

	if (json) {
		console.log(JSON.stringify(memory, null, 2));

		return;
	}

	console.log(`\n◆ Session Memory: ${memory.projectName}\n`);
	console.log(`Last updated: ${memory.lastUpdated}\n`);

	if (memory.lessonsLearned.length > 0) {
		console.log("Lessons Learned:");

		for (const lesson of memory.lessonsLearned) {
			console.log(`  • ${lesson}`);
		}

		console.log();
	}

	if (memory.successfulPatterns.length > 0) {
		console.log("Successful Patterns:");

		for (const pattern of memory.successfulPatterns) {
			console.log(`  • ${pattern}`);
		}

		console.log();
	}

	if (memory.failedApproaches.length > 0) {
		console.log("Failed Approaches:");

		for (const approach of memory.failedApproaches) {
			console.log(`  • ${approach}`);
		}

		console.log();
	}

	const taskTitles = Object.keys(memory.taskNotes);

	if (taskTitles.length > 0) {
		console.log("Task Notes:");

		for (const taskTitle of taskTitles) {
			console.log(`  ${taskTitle}:`);
			const note = memory.taskNotes[taskTitle];

			if (note) {
				const noteLines = note.split("\n");

				for (const line of noteLines) {
					console.log(`    ${line}`);
				}
			}
		}

		console.log();
	}

	const stats = sessionMemoryService.getStats();

	console.log("Summary:");
	console.log(`  Lessons: ${stats.lessonsCount}`);
	console.log(`  Patterns: ${stats.patternsCount}`);
	console.log(`  Failed approaches: ${stats.failedApproachesCount}`);
	console.log(`  Task notes: ${stats.taskNotesCount}`);
}

export function handleMemoryExport(): void {
	const sessionMemoryService = getSessionMemoryService();

	if (!sessionMemoryService.exists()) {
		console.log("No session memory found.");

		return;
	}

	const markdown = sessionMemoryService.exportAsMarkdown();

	console.log(markdown);
}

function executeMemoryClear(): void {
	const sessionMemoryService = getSessionMemoryService();
	const stats = sessionMemoryService.getStats();

	sessionMemoryService.clear();
	console.log("Session memory cleared.");
	console.log(`  Removed ${stats.lessonsCount} lessons`);
	console.log(`  Removed ${stats.patternsCount} patterns`);
	console.log(`  Removed ${stats.failedApproachesCount} failed approaches`);
	console.log(`  Removed ${stats.taskNotesCount} task notes`);
}

export function handleMemoryClear(force: boolean): void {
	const sessionMemoryService = getSessionMemoryService();
	const stats = sessionMemoryService.getStats();

	if (
		stats.lessonsCount === 0 &&
		stats.patternsCount === 0 &&
		stats.failedApproachesCount === 0 &&
		stats.taskNotesCount === 0
	) {
		console.log("Session memory is already empty.");

		return;
	}

	if (force) {
		executeMemoryClear();

		return;
	}

	console.log("This will clear all session memory including:");
	console.log(`  • ${stats.lessonsCount} lessons`);
	console.log(`  • ${stats.patternsCount} patterns`);
	console.log(`  • ${stats.failedApproachesCount} failed approaches`);
	console.log(`  • ${stats.taskNotesCount} task notes\n`);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.question("\x1b[31mAre you sure you want to clear all memory? (y/N): \x1b[0m", (answer) => {
		rl.close();

		const isConfirmed = answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";

		if (isConfirmed) {
			executeMemoryClear();
		} else {
			console.log("\nClear cancelled.");
		}
	});
}
