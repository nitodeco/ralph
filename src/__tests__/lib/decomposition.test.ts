import { describe, expect, test } from "bun:test";
import {
	applyDecomposition,
	formatDecompositionForProgress,
	parseDecompositionRequest,
} from "@/lib/decomposition.ts";
import {
	DECOMPOSITION_MARKER,
	DECOMPOSITION_OUTPUT_END,
	DECOMPOSITION_OUTPUT_START,
} from "@/lib/prompt.ts";
import type { DecompositionRequest, Prd } from "@/types.ts";

describe("parseDecompositionRequest", () => {
	test("returns not detected when marker is missing", () => {
		const output = "Some regular output without decomposition";
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(false);
		expect(result.request).toBeNull();
	});

	test("returns error when marker found but start tag missing", () => {
		const output = `${DECOMPOSITION_MARKER} some text ${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("missing or malformed");
	});

	test("returns error when marker found but end tag missing", () => {
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START} some json`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("missing or malformed");
	});

	test("returns error when start index is after end index", () => {
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_END} ${DECOMPOSITION_OUTPUT_START}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("missing or malformed");
	});

	test("returns error when JSON is invalid", () => {
		const invalidJson = "{ invalid json }";
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${invalidJson}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Failed to parse");
	});

	test("returns error when originalTaskTitle is missing", () => {
		const invalidRequest = {
			reason: "Task is too complex",
			suggestedSubtasks: [{ title: "Subtask 1", description: "Desc", steps: [] }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("returns error when originalTaskTitle is empty", () => {
		const invalidRequest = {
			originalTaskTitle: "   ",
			reason: "Task is too complex",
			suggestedSubtasks: [{ title: "Subtask 1", description: "Desc", steps: [] }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("returns error when reason is missing", () => {
		const invalidRequest = {
			originalTaskTitle: "Task 1",
			suggestedSubtasks: [{ title: "Subtask 1", description: "Desc", steps: [] }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("returns error when suggestedSubtasks is empty", () => {
		const invalidRequest = {
			originalTaskTitle: "Task 1",
			reason: "Task is too complex",
			suggestedSubtasks: [],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("returns error when subtask title is missing", () => {
		const invalidRequest = {
			originalTaskTitle: "Task 1",
			reason: "Task is too complex",
			suggestedSubtasks: [{ description: "Desc", steps: [] }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("returns error when subtask steps is not an array", () => {
		const invalidRequest = {
			originalTaskTitle: "Task 1",
			reason: "Task is too complex",
			suggestedSubtasks: [{ title: "Subtask 1", description: "Desc", steps: "not an array" }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(invalidRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).toBeNull();
		expect(result.error).toContain("Invalid decomposition request structure");
	});

	test("parses valid decomposition request", () => {
		const validRequest: DecompositionRequest = {
			originalTaskTitle: "Build authentication system",
			reason: "Task is too large for one iteration",
			suggestedSubtasks: [
				{ title: "Create user model", description: "Define user schema", steps: ["Step 1"] },
				{
					title: "Implement login",
					description: "Add login endpoint",
					steps: ["Step 1", "Step 2"],
				},
			],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}${JSON.stringify(validRequest)}${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).not.toBeNull();
		expect(result.request?.originalTaskTitle).toBe("Build authentication system");
		expect(result.request?.reason).toBe("Task is too large for one iteration");
		expect(result.request?.suggestedSubtasks).toHaveLength(2);
	});

	test("handles whitespace around JSON content", () => {
		const validRequest: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const output = `${DECOMPOSITION_MARKER} ${DECOMPOSITION_OUTPUT_START}\n  ${JSON.stringify(validRequest)}\n  ${DECOMPOSITION_OUTPUT_END}`;
		const result = parseDecompositionRequest(output);

		expect(result.detected).toBe(true);
		expect(result.request).not.toBeNull();
	});
});

describe("applyDecomposition", () => {
	test("returns error when original task not found", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [{ title: "Task 1", description: "Desc", steps: [], done: false }],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Nonexistent Task",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(false);
		expect(result.updatedPrd).toBeNull();
		expect(result.error).toContain("not found");
	});

	test("returns error when original task is already done", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [{ title: "Task 1", description: "Desc", steps: [], done: true }],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(false);
		expect(result.updatedPrd).toBeNull();
		expect(result.error).toContain("already marked as done");
	});

	test("finds task case-insensitively", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [{ title: "Task One", description: "Desc", steps: [], done: false }],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "task one",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(true);
		expect(result.updatedPrd).not.toBeNull();
	});

	test("replaces original task with subtasks", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [
				{ title: "Task 1", description: "Desc 1", steps: [], done: false },
				{ title: "Task 2", description: "Desc 2", steps: [], done: false },
			],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Too complex",
			suggestedSubtasks: [
				{ title: "Subtask 1", description: "Sub desc 1", steps: ["Step 1"] },
				{ title: "Subtask 2", description: "Sub desc 2", steps: ["Step 2"] },
			],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(true);
		expect(result.updatedPrd).not.toBeNull();
		expect(result.subtasksCreated).toBe(2);
		expect(result.updatedPrd?.tasks).toHaveLength(3);
		expect(result.updatedPrd?.tasks[0]?.title).toBe("Subtask 1");
		expect(result.updatedPrd?.tasks[1]?.title).toBe("Subtask 2");
		expect(result.updatedPrd?.tasks[2]?.title).toBe("Task 2");
	});

	test("preserves tasks before and after replaced task", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [
				{ title: "Before Task", description: "Before", steps: [], done: false },
				{ title: "Target Task", description: "Target", steps: [], done: false },
				{ title: "After Task", description: "After", steps: [], done: false },
			],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Target Task",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(true);
		expect(result.updatedPrd?.tasks[0]?.title).toBe("Before Task");
		expect(result.updatedPrd?.tasks[1]?.title).toBe("Subtask");
		expect(result.updatedPrd?.tasks[2]?.title).toBe("After Task");
	});

	test("sets all subtasks as not done", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [{ title: "Task 1", description: "Desc", steps: [], done: false }],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(true);
		expect(result.updatedPrd?.tasks[0]?.done).toBe(false);
	});

	test("preserves project name and other PRD fields", () => {
		const prd: Prd = {
			project: "My Project",
			tasks: [{ title: "Task 1", description: "Desc", steps: [], done: false }],
		};
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask", description: "Desc", steps: [] }],
		};
		const result = applyDecomposition(prd, request);

		expect(result.success).toBe(true);
		expect(result.updatedPrd?.project).toBe("My Project");
	});
});

describe("formatDecompositionForProgress", () => {
	test("formats decomposition request correctly", () => {
		const request: DecompositionRequest = {
			originalTaskTitle: "Build auth system",
			reason: "Too complex for one iteration",
			suggestedSubtasks: [
				{ title: "Create user model", description: "Model desc", steps: [] },
				{ title: "Add login", description: "Login desc", steps: [] },
			],
		};
		const formatted = formatDecompositionForProgress(request);

		expect(formatted).toContain("=== Task Decomposition ===");
		expect(formatted).toContain("Original task: Build auth system");
		expect(formatted).toContain("Reason: Too complex for one iteration");
		expect(formatted).toContain("Subtasks created: 2");
		expect(formatted).toContain("1. Create user model");
		expect(formatted).toContain("2. Add login");
		expect(formatted).toEndWith("\n");
	});

	test("handles single subtask", () => {
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: [{ title: "Subtask 1", description: "Desc", steps: [] }],
		};
		const formatted = formatDecompositionForProgress(request);

		expect(formatted).toContain("Subtasks created: 1");
		expect(formatted).toContain("1. Subtask 1");
	});

	test("handles many subtasks", () => {
		const request: DecompositionRequest = {
			originalTaskTitle: "Task 1",
			reason: "Reason",
			suggestedSubtasks: Array.from({ length: 5 }, (_, index) => ({
				title: `Subtask ${index + 1}`,
				description: "Desc",
				steps: [],
			})),
		};
		const formatted = formatDecompositionForProgress(request);

		expect(formatted).toContain("Subtasks created: 5");

		for (let index = 1; index <= 5; index++) {
			expect(formatted).toContain(`${index}. Subtask ${index}`);
		}
	});
});
