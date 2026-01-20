import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_MEMORY_FILE_PATH } from "@/lib/paths.ts";
import { isSessionMemory } from "@/lib/type-guards.ts";
import type { SessionMemory } from "@/types.ts";

const MAX_LESSONS = 50;
const MAX_PATTERNS = 20;
const MAX_FAILED_APPROACHES = 20;

function createEmptyMemory(projectName: string): SessionMemory {
	return {
		projectName,
		lessonsLearned: [],
		successfulPatterns: [],
		failedApproaches: [],
		taskNotes: {},
		lastUpdated: new Date().toISOString(),
	};
}

export function loadSessionMemory(projectName?: string): SessionMemory {
	if (!existsSync(SESSION_MEMORY_FILE_PATH)) {
		return createEmptyMemory(projectName ?? "Unknown Project");
	}

	try {
		const content = readFileSync(SESSION_MEMORY_FILE_PATH, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isSessionMemory(parsed)) {
			return createEmptyMemory(projectName ?? "Unknown Project");
		}

		return parsed;
	} catch {
		return createEmptyMemory(projectName ?? "Unknown Project");
	}
}

export function saveSessionMemory(memory: SessionMemory): void {
	ensureRalphDirExists();
	memory.lastUpdated = new Date().toISOString();
	writeFileSync(SESSION_MEMORY_FILE_PATH, JSON.stringify(memory, null, "\t"), "utf-8");
}

export function sessionMemoryExists(): boolean {
	return existsSync(SESSION_MEMORY_FILE_PATH);
}

export function initializeSessionMemory(projectName: string): SessionMemory {
	if (sessionMemoryExists()) {
		return loadSessionMemory(projectName);
	}

	const memory = createEmptyMemory(projectName);

	saveSessionMemory(memory);

	return memory;
}

export function addLesson(lesson: string): void {
	const memory = loadSessionMemory();

	if (memory.lessonsLearned.includes(lesson)) {
		return;
	}

	memory.lessonsLearned.push(lesson);

	if (memory.lessonsLearned.length > MAX_LESSONS) {
		memory.lessonsLearned = memory.lessonsLearned.slice(-MAX_LESSONS);
	}

	saveSessionMemory(memory);
}

export function addSuccessPattern(pattern: string): void {
	const memory = loadSessionMemory();

	if (memory.successfulPatterns.includes(pattern)) {
		return;
	}

	memory.successfulPatterns.push(pattern);

	if (memory.successfulPatterns.length > MAX_PATTERNS) {
		memory.successfulPatterns = memory.successfulPatterns.slice(-MAX_PATTERNS);
	}

	saveSessionMemory(memory);
}

export function addFailedApproach(approach: string): void {
	const memory = loadSessionMemory();

	if (memory.failedApproaches.includes(approach)) {
		return;
	}

	memory.failedApproaches.push(approach);

	if (memory.failedApproaches.length > MAX_FAILED_APPROACHES) {
		memory.failedApproaches = memory.failedApproaches.slice(-MAX_FAILED_APPROACHES);
	}

	saveSessionMemory(memory);
}

export function addTaskNote(taskTitle: string, note: string): void {
	const memory = loadSessionMemory();
	const existingNote = memory.taskNotes[taskTitle];

	if (existingNote) {
		memory.taskNotes[taskTitle] = `${existingNote}\n${note}`;
	} else {
		memory.taskNotes[taskTitle] = note;
	}

	saveSessionMemory(memory);
}

export function getTaskNote(taskTitle: string): string | null {
	const memory = loadSessionMemory();

	return memory.taskNotes[taskTitle] ?? null;
}

export function clearSessionMemory(): void {
	if (existsSync(SESSION_MEMORY_FILE_PATH)) {
		const memory = loadSessionMemory();
		const clearedMemory = createEmptyMemory(memory.projectName);

		saveSessionMemory(clearedMemory);
	}
}

export function getMemoryForPrompt(): string {
	const memory = loadSessionMemory();

	const sections: string[] = [];

	if (memory.lessonsLearned.length > 0) {
		const lessonsSection = memory.lessonsLearned.map((lesson) => `- ${lesson}`).join("\n");

		sections.push(`### Lessons Learned\n${lessonsSection}`);
	}

	if (memory.successfulPatterns.length > 0) {
		const patternsSection = memory.successfulPatterns.map((pattern) => `- ${pattern}`).join("\n");

		sections.push(`### Successful Patterns\n${patternsSection}`);
	}

	if (memory.failedApproaches.length > 0) {
		const failedSection = memory.failedApproaches
			.map((approach) => `- Avoid: ${approach}`)
			.join("\n");

		sections.push(`### Approaches to Avoid\n${failedSection}`);
	}

	if (sections.length === 0) {
		return "";
	}

	return `## Lessons from Previous Sessions\n${sections.join("\n\n")}\n`;
}

export function getMemoryForTask(taskTitle: string): string {
	const note = getTaskNote(taskTitle);

	if (!note) {
		return "";
	}

	return `### Notes for this task\n${note}\n`;
}

export function exportMemoryAsMarkdown(): string {
	const memory = loadSessionMemory();

	const lines: string[] = [
		`# Session Memory: ${memory.projectName}`,
		"",
		`Last updated: ${memory.lastUpdated}`,
		"",
	];

	if (memory.lessonsLearned.length > 0) {
		lines.push("## Lessons Learned");
		lines.push("");

		for (const lesson of memory.lessonsLearned) {
			lines.push(`- ${lesson}`);
		}

		lines.push("");
	}

	if (memory.successfulPatterns.length > 0) {
		lines.push("## Successful Patterns");
		lines.push("");

		for (const pattern of memory.successfulPatterns) {
			lines.push(`- ${pattern}`);
		}

		lines.push("");
	}

	if (memory.failedApproaches.length > 0) {
		lines.push("## Failed Approaches");
		lines.push("");

		for (const approach of memory.failedApproaches) {
			lines.push(`- ${approach}`);
		}

		lines.push("");
	}

	const taskTitles = Object.keys(memory.taskNotes);

	if (taskTitles.length > 0) {
		lines.push("## Task Notes");
		lines.push("");

		for (const taskTitle of taskTitles) {
			lines.push(`### ${taskTitle}`);
			lines.push("");
			lines.push(memory.taskNotes[taskTitle] ?? "");
			lines.push("");
		}
	}

	return lines.join("\n");
}

export function getSessionMemoryStats(): {
	lessonsCount: number;
	patternsCount: number;
	failedApproachesCount: number;
	taskNotesCount: number;
	lastUpdated: string | null;
} {
	if (!sessionMemoryExists()) {
		return {
			lessonsCount: 0,
			patternsCount: 0,
			failedApproachesCount: 0,
			taskNotesCount: 0,
			lastUpdated: null,
		};
	}

	const memory = loadSessionMemory();

	return {
		lessonsCount: memory.lessonsLearned.length,
		patternsCount: memory.successfulPatterns.length,
		failedApproachesCount: memory.failedApproaches.length,
		taskNotesCount: Object.keys(memory.taskNotes).length,
		lastUpdated: memory.lastUpdated,
	};
}
