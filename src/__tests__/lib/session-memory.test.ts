import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_MEMORY_FILE_PATH } from "@/lib/paths.ts";
import {
	addFailedApproach,
	addLesson,
	addSuccessPattern,
	addTaskNote,
	clearSessionMemory,
	exportMemoryAsMarkdown,
	getMemoryForPrompt,
	getMemoryForTask,
	getSessionMemoryStats,
	getTaskNote,
	initializeSessionMemory,
	loadSessionMemory,
	saveSessionMemory,
	sessionMemoryExists,
} from "@/lib/session-memory.ts";

const TEST_DIR = "/tmp/ralph-test-session-memory";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("session-memory functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("loadSessionMemory", () => {
		test("creates empty memory when file does not exist", () => {
			const memory = loadSessionMemory();

			expect(memory.projectName).toBe("Unknown Project");
			expect(memory.lessonsLearned).toEqual([]);
			expect(memory.successfulPatterns).toEqual([]);
			expect(memory.failedApproaches).toEqual([]);
			expect(memory.taskNotes).toEqual({});
		});

		test("uses provided project name when file does not exist", () => {
			const memory = loadSessionMemory("My Project");

			expect(memory.projectName).toBe("My Project");
		});

		test("loads existing memory file", () => {
			const originalMemory = initializeSessionMemory("Test Project");

			originalMemory.lessonsLearned.push("Test lesson");
			saveSessionMemory(originalMemory);

			const loaded = loadSessionMemory();

			expect(loaded.projectName).toBe("Test Project");
			expect(loaded.lessonsLearned).toContain("Test lesson");
		});

		test("handles corrupted JSON gracefully", () => {
			writeFileSync(SESSION_MEMORY_FILE_PATH, "{ invalid json }");

			const memory = loadSessionMemory("Fallback Project");

			expect(memory.projectName).toBe("Fallback Project");
			expect(memory.lessonsLearned).toEqual([]);
		});
	});

	describe("initializeSessionMemory", () => {
		test("creates new memory file if it does not exist", () => {
			expect(sessionMemoryExists()).toBe(false);
			const memory = initializeSessionMemory("New Project");

			expect(sessionMemoryExists()).toBe(true);
			expect(memory.projectName).toBe("New Project");
		});

		test("loads existing memory if file exists", () => {
			const original = initializeSessionMemory("Original Project");

			original.lessonsLearned.push("Existing lesson");
			saveSessionMemory(original);

			const loaded = initializeSessionMemory("New Project");

			expect(loaded.projectName).toBe("Original Project");
			expect(loaded.lessonsLearned).toContain("Existing lesson");
		});
	});

	describe("addLesson", () => {
		test("adds lesson to memory", () => {
			initializeSessionMemory("Test Project");
			addLesson("Always test your code");
			const memory = loadSessionMemory();

			expect(memory.lessonsLearned).toContain("Always test your code");
		});

		test("does not add duplicate lessons", () => {
			initializeSessionMemory("Test Project");
			addLesson("Test lesson");
			addLesson("Test lesson");
			const memory = loadSessionMemory();

			expect(memory.lessonsLearned.filter((lesson) => lesson === "Test lesson")).toHaveLength(1);
		});

		test("limits lessons to max count", () => {
			initializeSessionMemory("Test Project");

			for (let index = 0; index < 60; index++) {
				addLesson(`Lesson ${index}`);
			}

			const memory = loadSessionMemory();

			expect(memory.lessonsLearned.length).toBeLessThanOrEqual(50);
			expect(memory.lessonsLearned[0]).not.toBe("Lesson 0");
		});
	});

	describe("addSuccessPattern", () => {
		test("adds success pattern to memory", () => {
			initializeSessionMemory("Test Project");
			addSuccessPattern("Use TypeScript for type safety");
			const memory = loadSessionMemory();

			expect(memory.successfulPatterns).toContain("Use TypeScript for type safety");
		});

		test("does not add duplicate patterns", () => {
			initializeSessionMemory("Test Project");
			addSuccessPattern("Pattern");
			addSuccessPattern("Pattern");
			const memory = loadSessionMemory();

			expect(memory.successfulPatterns.filter((pattern) => pattern === "Pattern")).toHaveLength(1);
		});

		test("limits patterns to max count", () => {
			initializeSessionMemory("Test Project");

			for (let index = 0; index < 25; index++) {
				addSuccessPattern(`Pattern ${index}`);
			}

			const memory = loadSessionMemory();

			expect(memory.successfulPatterns.length).toBeLessThanOrEqual(20);
		});
	});

	describe("addFailedApproach", () => {
		test("adds failed approach to memory", () => {
			initializeSessionMemory("Test Project");
			addFailedApproach("Don't use global variables");
			const memory = loadSessionMemory();

			expect(memory.failedApproaches).toContain("Don't use global variables");
		});

		test("does not add duplicate approaches", () => {
			initializeSessionMemory("Test Project");
			addFailedApproach("Avoid approach");
			addFailedApproach("Avoid approach");
			const memory = loadSessionMemory();

			expect(
				memory.failedApproaches.filter((approach) => approach === "Avoid approach"),
			).toHaveLength(1);
		});

		test("limits approaches to max count", () => {
			initializeSessionMemory("Test Project");

			for (let index = 0; index < 25; index++) {
				addFailedApproach(`Approach ${index}`);
			}

			const memory = loadSessionMemory();

			expect(memory.failedApproaches.length).toBeLessThanOrEqual(20);
		});
	});

	describe("addTaskNote and getTaskNote", () => {
		test("adds note for task", () => {
			initializeSessionMemory("Test Project");
			addTaskNote("Task 1", "Important note about this task");
			const note = getTaskNote("Task 1");

			expect(note).toBe("Important note about this task");
		});

		test("appends to existing note", () => {
			initializeSessionMemory("Test Project");
			addTaskNote("Task 1", "First note");
			addTaskNote("Task 1", "Second note");
			const note = getTaskNote("Task 1");

			expect(note).toContain("First note");
			expect(note).toContain("Second note");
		});

		test("returns null for non-existent task note", () => {
			initializeSessionMemory("Test Project");
			const note = getTaskNote("Nonexistent Task");

			expect(note).toBeNull();
		});

		test("handles multiple tasks", () => {
			initializeSessionMemory("Test Project");
			addTaskNote("Task 1", "Note 1");
			addTaskNote("Task 2", "Note 2");
			expect(getTaskNote("Task 1")).toBe("Note 1");
			expect(getTaskNote("Task 2")).toBe("Note 2");
		});
	});

	describe("getMemoryForPrompt", () => {
		test("returns empty string when memory is empty", () => {
			initializeSessionMemory("Test Project");
			const prompt = getMemoryForPrompt();

			expect(prompt).toBe("");
		});

		test("includes lessons learned section", () => {
			initializeSessionMemory("Test Project");
			addLesson("Lesson 1");
			addLesson("Lesson 2");
			const prompt = getMemoryForPrompt();

			expect(prompt).toContain("### Lessons Learned");
			expect(prompt).toContain("- Lesson 1");
			expect(prompt).toContain("- Lesson 2");
		});

		test("includes successful patterns section", () => {
			initializeSessionMemory("Test Project");
			addSuccessPattern("Pattern 1");
			const prompt = getMemoryForPrompt();

			expect(prompt).toContain("### Successful Patterns");
			expect(prompt).toContain("- Pattern 1");
		});

		test("includes failed approaches section", () => {
			initializeSessionMemory("Test Project");
			addFailedApproach("Approach 1");
			const prompt = getMemoryForPrompt();

			expect(prompt).toContain("### Approaches to Avoid");
			expect(prompt).toContain("- Avoid: Approach 1");
		});

		test("includes all sections when present", () => {
			initializeSessionMemory("Test Project");
			addLesson("Lesson");
			addSuccessPattern("Pattern");
			addFailedApproach("Approach");
			const prompt = getMemoryForPrompt();

			expect(prompt).toContain("## Lessons from Previous Sessions");
			expect(prompt).toContain("Lessons Learned");
			expect(prompt).toContain("Successful Patterns");
			expect(prompt).toContain("Approaches to Avoid");
		});
	});

	describe("getMemoryForTask", () => {
		test("returns empty string when task has no notes", () => {
			initializeSessionMemory("Test Project");
			const memory = getMemoryForTask("Task 1");

			expect(memory).toBe("");
		});

		test("returns formatted note when task has notes", () => {
			initializeSessionMemory("Test Project");
			addTaskNote("Task 1", "Important note");
			const memory = getMemoryForTask("Task 1");

			expect(memory).toContain("### Notes for this task");
			expect(memory).toContain("Important note");
		});
	});

	describe("exportMemoryAsMarkdown", () => {
		test("exports empty memory correctly", () => {
			initializeSessionMemory("Test Project");
			const markdown = exportMemoryAsMarkdown();

			expect(markdown).toContain("# Session Memory: Test Project");
			expect(markdown).toContain("Last updated:");
		});

		test("exports lessons learned", () => {
			initializeSessionMemory("Test Project");
			addLesson("Lesson 1");
			addLesson("Lesson 2");
			const markdown = exportMemoryAsMarkdown();

			expect(markdown).toContain("## Lessons Learned");
			expect(markdown).toContain("- Lesson 1");
			expect(markdown).toContain("- Lesson 2");
		});

		test("exports successful patterns", () => {
			initializeSessionMemory("Test Project");
			addSuccessPattern("Pattern 1");
			const markdown = exportMemoryAsMarkdown();

			expect(markdown).toContain("## Successful Patterns");
			expect(markdown).toContain("- Pattern 1");
		});

		test("exports failed approaches", () => {
			initializeSessionMemory("Test Project");
			addFailedApproach("Approach 1");
			const markdown = exportMemoryAsMarkdown();

			expect(markdown).toContain("## Failed Approaches");
			expect(markdown).toContain("- Approach 1");
		});

		test("exports task notes", () => {
			initializeSessionMemory("Test Project");
			addTaskNote("Task 1", "Note content");
			const markdown = exportMemoryAsMarkdown();

			expect(markdown).toContain("## Task Notes");
			expect(markdown).toContain("### Task 1");
			expect(markdown).toContain("Note content");
		});
	});

	describe("clearSessionMemory", () => {
		test("clears all memory while preserving project name", () => {
			initializeSessionMemory("Test Project");
			addLesson("Lesson");
			addSuccessPattern("Pattern");
			addFailedApproach("Approach");
			addTaskNote("Task", "Note");

			clearSessionMemory();
			const memory = loadSessionMemory();

			expect(memory.projectName).toBe("Test Project");
			expect(memory.lessonsLearned).toEqual([]);
			expect(memory.successfulPatterns).toEqual([]);
			expect(memory.failedApproaches).toEqual([]);
			expect(memory.taskNotes).toEqual({});
		});

		test("does not throw when memory file does not exist", () => {
			expect(() => clearSessionMemory()).not.toThrow();
		});
	});

	describe("getSessionMemoryStats", () => {
		test("returns zero stats when memory does not exist", () => {
			const stats = getSessionMemoryStats();

			expect(stats.lessonsCount).toBe(0);
			expect(stats.patternsCount).toBe(0);
			expect(stats.failedApproachesCount).toBe(0);
			expect(stats.taskNotesCount).toBe(0);
			expect(stats.lastUpdated).toBeNull();
		});

		test("returns correct stats for populated memory", () => {
			initializeSessionMemory("Test Project");
			addLesson("Lesson 1");
			addLesson("Lesson 2");
			addSuccessPattern("Pattern 1");
			addFailedApproach("Approach 1");
			addTaskNote("Task 1", "Note");

			const stats = getSessionMemoryStats();

			expect(stats.lessonsCount).toBe(2);
			expect(stats.patternsCount).toBe(1);
			expect(stats.failedApproachesCount).toBe(1);
			expect(stats.taskNotesCount).toBe(1);
			expect(stats.lastUpdated).not.toBeNull();
		});
	});

	describe("sessionMemoryExists", () => {
		test("returns false when file does not exist", () => {
			expect(sessionMemoryExists()).toBe(false);
		});

		test("returns true when file exists", () => {
			initializeSessionMemory("Test Project");
			expect(sessionMemoryExists()).toBe(true);
		});
	});
});
