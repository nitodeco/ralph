import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	buildAddTaskPrompt,
	buildPrdGenerationPrompt,
	buildPrompt,
	COMPLETION_MARKER,
	PRD_OUTPUT_END,
	PRD_OUTPUT_START,
	TASK_OUTPUT_END,
	TASK_OUTPUT_START,
} from "@/lib/prompt.ts";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/index.ts";
import type { Prd } from "@/types.ts";

describe("buildPrompt", () => {
	beforeEach(() => {
		bootstrapTestServices();
	});

	afterEach(() => {
		teardownTestServices();
	});

	test("generates basic prompt without options", () => {
		const prompt = buildPrompt();

		expect(prompt).toContain("@.ralph/prd.json");
		expect(prompt).toContain("@.ralph/progress.txt");
		expect(prompt).toContain("coding agent");
		expect(prompt).toContain("Find the next most important task");
		expect(prompt).toContain(COMPLETION_MARKER);
	});

	test("includes specific task when provided", () => {
		const prompt = buildPrompt({ specificTask: "Implement login" });

		expect(prompt).toContain('Work on the SPECIFIED task: "Implement login"');
		expect(prompt).not.toContain("Find the next most important task");
	});

	test("includes instructions when provided", () => {
		const instructions = "Always use TypeScript\nFollow clean code principles";
		const prompt = buildPrompt({ instructions });

		expect(prompt).toContain("## Project Instructions");
		expect(prompt).toContain("Always use TypeScript");
		expect(prompt).toContain("Follow clean code principles");
	});

	test("does not include instructions section when null", () => {
		const prompt = buildPrompt({ instructions: null });

		expect(prompt).not.toContain("## Project Instructions");
	});

	test("includes all workflow steps", () => {
		const prompt = buildPrompt();

		expect(prompt).toContain("1. Get oriented by reading");
		expect(prompt).toContain("3. Implement ONLY that task");
		expect(prompt).toContain("4. Verify your implementation");
		expect(prompt).toContain("5. Update .ralph/progress.txt");
		expect(prompt).toContain("6. Stage and commit");
	});

	test("includes rules section", () => {
		const prompt = buildPrompt();

		expect(prompt).toContain("## Rules");
		expect(prompt).toContain("ONLY work on ONE task at a time");
		expect(prompt).toContain("buildable state");
		expect(prompt).toContain("If the build fails, fix it");
	});

	test("includes commit instructions when in git repository", () => {
		const prompt = buildPrompt({ isGitRepository: true });

		expect(prompt).toContain("6. Stage and commit your changes with a meaningful commit message");
		expect(prompt).toContain("If the build fails, fix it before committing");
		expect(prompt).not.toContain("this is not a git repository");
	});

	test("excludes commit instructions when not in git repository", () => {
		const prompt = buildPrompt({ isGitRepository: false });

		expect(prompt).toContain("this is not a git repository, so no commit is needed");
		expect(prompt).not.toContain("Stage and commit your changes with a meaningful commit message");
		expect(prompt).not.toContain("If the build fails, fix it before committing");
	});

	test("defaults to including commit instructions", () => {
		const prompt = buildPrompt();

		expect(prompt).toContain("6. Stage and commit your changes with a meaningful commit message");
	});
});

describe("buildPrdGenerationPrompt", () => {
	test("generates JSON format prompt", () => {
		const prompt = buildPrdGenerationPrompt("Build a todo app");

		expect(prompt).toContain("Build a todo app");
		expect(prompt).toContain("JSON format");
		expect(prompt).toContain(PRD_OUTPUT_START);
		expect(prompt).toContain(PRD_OUTPUT_END);
		expect(prompt).toContain('"project"');
		expect(prompt).toContain('"tasks"');
	});

	test("includes planning instructions", () => {
		const prompt = buildPrdGenerationPrompt("Test project");

		expect(prompt).toContain("break it down into logical");
		expect(prompt).toContain("small enough to complete in one coding session");
		expect(prompt).toContain("Order tasks logically");
	});
});

describe("buildAddTaskPrompt", () => {
	const existingPrd: Prd = {
		project: "Test Project",
		tasks: [
			{ title: "Setup project", description: "Initial setup", steps: ["Step 1"], done: true },
			{
				title: "Add authentication",
				description: "Auth system",
				steps: ["Step 1"],
				done: false,
			},
		],
	};

	test("generates JSON format task prompt", () => {
		const prompt = buildAddTaskPrompt("Add user profile page", existingPrd);

		expect(prompt).toContain("Add user profile page");
		expect(prompt).toContain("Test Project");
		expect(prompt).toContain(TASK_OUTPUT_START);
		expect(prompt).toContain(TASK_OUTPUT_END);
		expect(prompt).toContain('"title"');
	});

	test("includes existing tasks list", () => {
		const prompt = buildAddTaskPrompt("New task", existingPrd);

		expect(prompt).toContain("1. Setup project (done)");
		expect(prompt).toContain("2. Add authentication");
	});

	test("handles empty existing tasks", () => {
		const emptyPrd: Prd = { project: "Empty Project", tasks: [] };
		const prompt = buildAddTaskPrompt("First task", emptyPrd);

		expect(prompt).toContain("No existing tasks");
	});

	test("includes instructions to avoid duplicates", () => {
		const prompt = buildAddTaskPrompt("New task", existingPrd);

		expect(prompt).toContain("doesn't duplicate existing tasks");
	});
});

describe("prompt constants", () => {
	test("COMPLETION_MARKER is correct", () => {
		expect(COMPLETION_MARKER).toBe("<promise>COMPLETE</promise>");
	});

	test("PRD_OUTPUT markers are correct", () => {
		expect(PRD_OUTPUT_START).toBe("<prd_output>");
		expect(PRD_OUTPUT_END).toBe("</prd_output>");
	});

	test("TASK_OUTPUT markers are correct", () => {
		expect(TASK_OUTPUT_START).toBe("<task_output>");
		expect(TASK_OUTPUT_END).toBe("</task_output>");
	});
});
