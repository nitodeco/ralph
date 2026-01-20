import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_MEMORY_FILE_PATH } from "@/lib/paths.ts";
import { exportAsMarkdown, formatForPrompt, formatForTask } from "./formatters.ts";
import {
	SESSION_MEMORY_CONSTANTS,
	type SessionMemory,
	type SessionMemoryService,
	type SessionMemoryStats,
} from "./types.ts";
import { isSessionMemory } from "./validation.ts";

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

export function createSessionMemoryService(): SessionMemoryService {
	let cachedMemory: SessionMemory | null = null;

	function load(projectName?: string): SessionMemory {
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

	function get(): SessionMemory {
		if (cachedMemory === null) {
			cachedMemory = load();
		}

		return cachedMemory;
	}

	function save(memory: SessionMemory): void {
		ensureRalphDirExists();
		memory.lastUpdated = new Date().toISOString();
		writeFileSync(SESSION_MEMORY_FILE_PATH, JSON.stringify(memory, null, "\t"), "utf-8");
		cachedMemory = memory;
	}

	function exists(): boolean {
		return existsSync(SESSION_MEMORY_FILE_PATH);
	}

	function initialize(projectName: string): SessionMemory {
		if (exists()) {
			const memory = load(projectName);

			cachedMemory = memory;

			return memory;
		}

		const memory = createEmptyMemory(projectName);

		save(memory);

		return memory;
	}

	function invalidate(): void {
		cachedMemory = null;
	}

	function addLesson(lesson: string): void {
		const memory = get();

		if (memory.lessonsLearned.includes(lesson)) {
			return;
		}

		memory.lessonsLearned.push(lesson);

		if (memory.lessonsLearned.length > SESSION_MEMORY_CONSTANTS.MAX_LESSONS) {
			memory.lessonsLearned = memory.lessonsLearned.slice(-SESSION_MEMORY_CONSTANTS.MAX_LESSONS);
		}

		save(memory);
	}

	function addSuccessPattern(pattern: string): void {
		const memory = get();

		if (memory.successfulPatterns.includes(pattern)) {
			return;
		}

		memory.successfulPatterns.push(pattern);

		if (memory.successfulPatterns.length > SESSION_MEMORY_CONSTANTS.MAX_PATTERNS) {
			memory.successfulPatterns = memory.successfulPatterns.slice(
				-SESSION_MEMORY_CONSTANTS.MAX_PATTERNS,
			);
		}

		save(memory);
	}

	function addFailedApproach(approach: string): void {
		const memory = get();

		if (memory.failedApproaches.includes(approach)) {
			return;
		}

		memory.failedApproaches.push(approach);

		if (memory.failedApproaches.length > SESSION_MEMORY_CONSTANTS.MAX_FAILED_APPROACHES) {
			memory.failedApproaches = memory.failedApproaches.slice(
				-SESSION_MEMORY_CONSTANTS.MAX_FAILED_APPROACHES,
			);
		}

		save(memory);
	}

	function addTaskNote(taskTitle: string, note: string): void {
		const memory = get();
		const existingNote = memory.taskNotes[taskTitle];

		if (existingNote) {
			memory.taskNotes[taskTitle] = `${existingNote}\n${note}`;
		} else {
			memory.taskNotes[taskTitle] = note;
		}

		save(memory);
	}

	function getTaskNote(taskTitle: string): string | null {
		const memory = get();

		return memory.taskNotes[taskTitle] ?? null;
	}

	function clear(): void {
		if (exists()) {
			const memory = get();
			const clearedMemory = createEmptyMemory(memory.projectName);

			save(clearedMemory);
		}
	}

	function getStats(): SessionMemoryStats {
		if (!exists()) {
			return {
				lessonsCount: 0,
				patternsCount: 0,
				failedApproachesCount: 0,
				taskNotesCount: 0,
				lastUpdated: null,
			};
		}

		const memory = get();

		return {
			lessonsCount: memory.lessonsLearned.length,
			patternsCount: memory.successfulPatterns.length,
			failedApproachesCount: memory.failedApproaches.length,
			taskNotesCount: Object.keys(memory.taskNotes).length,
			lastUpdated: memory.lastUpdated,
		};
	}

	return {
		get,
		load,
		save,
		exists,
		initialize,
		invalidate,
		addLesson,
		addSuccessPattern,
		addFailedApproach,
		addTaskNote,
		getTaskNote,
		clear,
		getStats,
		formatForPrompt: () => formatForPrompt(get()),
		formatForTask: (taskTitle: string) => formatForTask(getTaskNote(taskTitle)),
		exportAsMarkdown: () => exportAsMarkdown(get()),
	};
}
