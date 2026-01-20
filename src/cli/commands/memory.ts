import {
	clearSessionMemory,
	exportMemoryAsMarkdown,
	getSessionMemoryStats,
	loadSessionMemory,
	sessionMemoryExists,
} from "@/lib/session-memory.ts";

export function printMemory(json: boolean): void {
	if (!sessionMemoryExists()) {
		if (json) {
			console.log(JSON.stringify({ error: "No session memory found" }));
		} else {
			console.log("No session memory found. Memory is created automatically during sessions.");
		}
		return;
	}

	const memory = loadSessionMemory();

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

	const stats = getSessionMemoryStats();
	console.log("Summary:");
	console.log(`  Lessons: ${stats.lessonsCount}`);
	console.log(`  Patterns: ${stats.patternsCount}`);
	console.log(`  Failed approaches: ${stats.failedApproachesCount}`);
	console.log(`  Task notes: ${stats.taskNotesCount}`);
}

export function handleMemoryExport(): void {
	if (!sessionMemoryExists()) {
		console.log("No session memory found.");
		return;
	}

	const markdown = exportMemoryAsMarkdown();
	console.log(markdown);
}

export function handleMemoryClear(): void {
	const stats = getSessionMemoryStats();

	if (
		stats.lessonsCount === 0 &&
		stats.patternsCount === 0 &&
		stats.failedApproachesCount === 0 &&
		stats.taskNotesCount === 0
	) {
		console.log("Session memory is already empty.");
		return;
	}

	clearSessionMemory();
	console.log("Session memory cleared.");
	console.log(`  Removed ${stats.lessonsCount} lessons`);
	console.log(`  Removed ${stats.patternsCount} patterns`);
	console.log(`  Removed ${stats.failedApproachesCount} failed approaches`);
	console.log(`  Removed ${stats.taskNotesCount} task notes`);
}
