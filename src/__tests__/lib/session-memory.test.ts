import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_MEMORY_FILE_PATH } from "@/lib/paths.ts";
import {
	bootstrapTestServices,
	getSessionMemoryService,
	teardownTestServices,
} from "@/lib/services/index.ts";
import { createSessionMemoryService } from "@/lib/services/session-memory/implementation.ts";

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
		bootstrapTestServices({
			sessionMemory: createSessionMemoryService(),
		});
	});

	afterEach(() => {
		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("load", () => {
		test("creates empty memory when file does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();
			const memory = sessionMemoryService.load();

			expect(memory.projectName).toBe("Unknown Project");
			expect(memory.lessonsLearned).toEqual([]);
			expect(memory.successfulPatterns).toEqual([]);
			expect(memory.failedApproaches).toEqual([]);
			expect(memory.taskNotes).toEqual({});
		});

		test("uses provided project name when file does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();
			const memory = sessionMemoryService.load("My Project");

			expect(memory.projectName).toBe("My Project");
		});

		test("loads existing memory file", () => {
			const sessionMemoryService = getSessionMemoryService();
			const originalMemory = sessionMemoryService.initialize("Test Project");

			originalMemory.lessonsLearned.push("Test lesson");
			sessionMemoryService.save(originalMemory);

			sessionMemoryService.invalidate();
			const loaded = sessionMemoryService.load();

			expect(loaded.projectName).toBe("Test Project");
			expect(loaded.lessonsLearned).toContain("Test lesson");
		});

		test("handles corrupted JSON gracefully", () => {
			const sessionMemoryService = getSessionMemoryService();

			writeFileSync(SESSION_MEMORY_FILE_PATH, "{ invalid json }");

			sessionMemoryService.invalidate();
			const memory = sessionMemoryService.load("Fallback Project");

			expect(memory.projectName).toBe("Fallback Project");
			expect(memory.lessonsLearned).toEqual([]);
		});
	});

	describe("initialize", () => {
		test("creates new memory file if it does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();

			expect(sessionMemoryService.exists()).toBe(false);
			const memory = sessionMemoryService.initialize("New Project");

			expect(sessionMemoryService.exists()).toBe(true);
			expect(memory.projectName).toBe("New Project");
		});

		test("loads existing memory if file exists", () => {
			const sessionMemoryService = getSessionMemoryService();
			const original = sessionMemoryService.initialize("Original Project");

			original.lessonsLearned.push("Existing lesson");
			sessionMemoryService.save(original);

			sessionMemoryService.invalidate();
			const loaded = sessionMemoryService.initialize("New Project");

			expect(loaded.projectName).toBe("Original Project");
			expect(loaded.lessonsLearned).toContain("Existing lesson");
		});
	});

	describe("addLesson", () => {
		test("adds lesson to memory", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Always test your code");
			const memory = sessionMemoryService.get();

			expect(memory.lessonsLearned).toContain("Always test your code");
		});

		test("does not add duplicate lessons", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Test lesson");
			sessionMemoryService.addLesson("Test lesson");
			const memory = sessionMemoryService.get();

			expect(memory.lessonsLearned.filter((lesson) => lesson === "Test lesson")).toHaveLength(1);
		});

		test("limits lessons to max count", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");

			for (let index = 0; index < 60; index++) {
				sessionMemoryService.addLesson(`Lesson ${index}`);
			}

			const memory = sessionMemoryService.get();

			expect(memory.lessonsLearned.length).toBeLessThanOrEqual(50);
			expect(memory.lessonsLearned[0]).not.toBe("Lesson 0");
		});
	});

	describe("addSuccessPattern", () => {
		test("adds success pattern to memory", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addSuccessPattern("Use TypeScript for type safety");
			const memory = sessionMemoryService.get();

			expect(memory.successfulPatterns).toContain("Use TypeScript for type safety");
		});

		test("does not add duplicate patterns", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addSuccessPattern("Pattern");
			sessionMemoryService.addSuccessPattern("Pattern");
			const memory = sessionMemoryService.get();

			expect(memory.successfulPatterns.filter((pattern) => pattern === "Pattern")).toHaveLength(1);
		});

		test("limits patterns to max count", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");

			for (let index = 0; index < 25; index++) {
				sessionMemoryService.addSuccessPattern(`Pattern ${index}`);
			}

			const memory = sessionMemoryService.get();

			expect(memory.successfulPatterns.length).toBeLessThanOrEqual(20);
		});
	});

	describe("addFailedApproach", () => {
		test("adds failed approach to memory", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addFailedApproach("Don't use global variables");
			const memory = sessionMemoryService.get();

			expect(memory.failedApproaches).toContain("Don't use global variables");
		});

		test("does not add duplicate approaches", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addFailedApproach("Avoid approach");
			sessionMemoryService.addFailedApproach("Avoid approach");
			const memory = sessionMemoryService.get();

			expect(
				memory.failedApproaches.filter((approach) => approach === "Avoid approach"),
			).toHaveLength(1);
		});

		test("limits approaches to max count", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");

			for (let index = 0; index < 25; index++) {
				sessionMemoryService.addFailedApproach(`Approach ${index}`);
			}

			const memory = sessionMemoryService.get();

			expect(memory.failedApproaches.length).toBeLessThanOrEqual(20);
		});
	});

	describe("addTaskNote and getTaskNote", () => {
		test("adds note for task", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addTaskNote("Task 1", "Important note about this task");
			const note = sessionMemoryService.getTaskNote("Task 1");

			expect(note).toBe("Important note about this task");
		});

		test("appends to existing note", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addTaskNote("Task 1", "First note");
			sessionMemoryService.addTaskNote("Task 1", "Second note");
			const note = sessionMemoryService.getTaskNote("Task 1");

			expect(note).toContain("First note");
			expect(note).toContain("Second note");
		});

		test("returns null for non-existent task note", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			const note = sessionMemoryService.getTaskNote("Nonexistent Task");

			expect(note).toBeNull();
		});

		test("handles multiple tasks", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addTaskNote("Task 1", "Note 1");
			sessionMemoryService.addTaskNote("Task 2", "Note 2");
			expect(sessionMemoryService.getTaskNote("Task 1")).toBe("Note 1");
			expect(sessionMemoryService.getTaskNote("Task 2")).toBe("Note 2");
		});
	});

	describe("formatForPrompt", () => {
		test("returns empty string when memory is empty", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			const prompt = sessionMemoryService.formatForPrompt();

			expect(prompt).toBe("");
		});

		test("includes lessons learned section", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Lesson 1");
			sessionMemoryService.addLesson("Lesson 2");
			const prompt = sessionMemoryService.formatForPrompt();

			expect(prompt).toContain("### Lessons Learned");
			expect(prompt).toContain("- Lesson 1");
			expect(prompt).toContain("- Lesson 2");
		});

		test("includes successful patterns section", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addSuccessPattern("Pattern 1");
			const prompt = sessionMemoryService.formatForPrompt();

			expect(prompt).toContain("### Successful Patterns");
			expect(prompt).toContain("- Pattern 1");
		});

		test("includes failed approaches section", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addFailedApproach("Approach 1");
			const prompt = sessionMemoryService.formatForPrompt();

			expect(prompt).toContain("### Approaches to Avoid");
			expect(prompt).toContain("- Avoid: Approach 1");
		});

		test("includes all sections when present", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Lesson");
			sessionMemoryService.addSuccessPattern("Pattern");
			sessionMemoryService.addFailedApproach("Approach");
			const prompt = sessionMemoryService.formatForPrompt();

			expect(prompt).toContain("## Lessons from Previous Sessions");
			expect(prompt).toContain("Lessons Learned");
			expect(prompt).toContain("Successful Patterns");
			expect(prompt).toContain("Approaches to Avoid");
		});
	});

	describe("formatForTask", () => {
		test("returns empty string when task has no notes", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			const memory = sessionMemoryService.formatForTask("Task 1");

			expect(memory).toBe("");
		});

		test("returns formatted note when task has notes", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addTaskNote("Task 1", "Important note");
			const memory = sessionMemoryService.formatForTask("Task 1");

			expect(memory).toContain("### Notes for this task");
			expect(memory).toContain("Important note");
		});
	});

	describe("exportAsMarkdown", () => {
		test("exports empty memory correctly", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			const markdown = sessionMemoryService.exportAsMarkdown();

			expect(markdown).toContain("# Session Memory: Test Project");
			expect(markdown).toContain("Last updated:");
		});

		test("exports lessons learned", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Lesson 1");
			sessionMemoryService.addLesson("Lesson 2");
			const markdown = sessionMemoryService.exportAsMarkdown();

			expect(markdown).toContain("## Lessons Learned");
			expect(markdown).toContain("- Lesson 1");
			expect(markdown).toContain("- Lesson 2");
		});

		test("exports successful patterns", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addSuccessPattern("Pattern 1");
			const markdown = sessionMemoryService.exportAsMarkdown();

			expect(markdown).toContain("## Successful Patterns");
			expect(markdown).toContain("- Pattern 1");
		});

		test("exports failed approaches", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addFailedApproach("Approach 1");
			const markdown = sessionMemoryService.exportAsMarkdown();

			expect(markdown).toContain("## Failed Approaches");
			expect(markdown).toContain("- Approach 1");
		});

		test("exports task notes", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addTaskNote("Task 1", "Note content");
			const markdown = sessionMemoryService.exportAsMarkdown();

			expect(markdown).toContain("## Task Notes");
			expect(markdown).toContain("### Task 1");
			expect(markdown).toContain("Note content");
		});
	});

	describe("clear", () => {
		test("clears all memory while preserving project name", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Lesson");
			sessionMemoryService.addSuccessPattern("Pattern");
			sessionMemoryService.addFailedApproach("Approach");
			sessionMemoryService.addTaskNote("Task", "Note");

			sessionMemoryService.clear();
			const memory = sessionMemoryService.get();

			expect(memory.projectName).toBe("Test Project");
			expect(memory.lessonsLearned).toEqual([]);
			expect(memory.successfulPatterns).toEqual([]);
			expect(memory.failedApproaches).toEqual([]);
			expect(memory.taskNotes).toEqual({});
		});

		test("does not throw when memory file does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();

			expect(() => sessionMemoryService.clear()).not.toThrow();
		});
	});

	describe("getStats", () => {
		test("returns zero stats when memory does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();
			const stats = sessionMemoryService.getStats();

			expect(stats.lessonsCount).toBe(0);
			expect(stats.patternsCount).toBe(0);
			expect(stats.failedApproachesCount).toBe(0);
			expect(stats.taskNotesCount).toBe(0);
			expect(stats.lastUpdated).toBeNull();
		});

		test("returns correct stats for populated memory", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			sessionMemoryService.addLesson("Lesson 1");
			sessionMemoryService.addLesson("Lesson 2");
			sessionMemoryService.addSuccessPattern("Pattern 1");
			sessionMemoryService.addFailedApproach("Approach 1");
			sessionMemoryService.addTaskNote("Task 1", "Note");

			const stats = sessionMemoryService.getStats();

			expect(stats.lessonsCount).toBe(2);
			expect(stats.patternsCount).toBe(1);
			expect(stats.failedApproachesCount).toBe(1);
			expect(stats.taskNotesCount).toBe(1);
			expect(stats.lastUpdated).not.toBeNull();
		});
	});

	describe("exists", () => {
		test("returns false when file does not exist", () => {
			const sessionMemoryService = getSessionMemoryService();

			expect(sessionMemoryService.exists()).toBe(false);
		});

		test("returns true when file exists", () => {
			const sessionMemoryService = getSessionMemoryService();

			sessionMemoryService.initialize("Test Project");
			expect(sessionMemoryService.exists()).toBe(true);
		});
	});
});
