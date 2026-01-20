import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
	canWorkOnTask,
	createEmptyPrd,
	findPrdFile,
	getNextTask,
	getNextTaskWithIndex,
	getTaskByIndex,
	getTaskByTitle,
	invalidatePrdCache,
	isPrdComplete,
	loadPrdWithValidation,
} from "@/lib/prd.ts";
import type { Prd, PrdTask } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-prd";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("prd functions", () => {
	beforeEach(() => {
		invalidatePrdCache();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("findPrdFile", () => {
		test("returns null when no PRD file exists", () => {
			const result = findPrdFile();

			expect(result).toBeNull();
		});

		test("finds JSON PRD file", () => {
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify({ project: "test", tasks: [] }));
			const result = findPrdFile();

			expect(result).toBe(".ralph/prd.json");
		});

		test("finds YAML PRD file", () => {
			writeFileSync(`${RALPH_DIR}/prd.yaml`, "project: test\ntasks: []");
			const result = findPrdFile();

			expect(result).toBe(".ralph/prd.yaml");
		});

		test("prefers JSON over YAML when both exist", () => {
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify({ project: "test", tasks: [] }));
			writeFileSync(`${RALPH_DIR}/prd.yaml`, "project: test\ntasks: []");
			const result = findPrdFile();

			expect(result).toBe(".ralph/prd.json");
		});
	});

	describe("loadPrdWithValidation", () => {
		test("returns null prd when no file exists", () => {
			const result = loadPrdWithValidation();

			expect(result.prd).toBeNull();
			expect(result.validationError).toBeUndefined();
		});

		test("loads valid JSON PRD", () => {
			const prd: Prd = {
				project: "Test Project",
				tasks: [{ title: "Task 1", description: "Description", steps: ["Step 1"], done: false }],
			};

			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify(prd));

			const result = loadPrdWithValidation();

			expect(result.prd).not.toBeNull();
			expect(result.prd?.project).toBe("Test Project");
			expect(result.prd?.tasks).toHaveLength(1);
		});

		test("loads valid YAML PRD", () => {
			const yamlContent = `project: Test Project
tasks:
  - title: Task 1
    description: Description
    steps:
      - Step 1
    done: false`;

			writeFileSync(`${RALPH_DIR}/prd.yaml`, yamlContent);

			const result = loadPrdWithValidation();

			expect(result.prd).not.toBeNull();
			expect(result.prd?.project).toBe("Test Project");
		});

		test("returns validation error when project field is missing", () => {
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify({ tasks: [] }));

			const result = loadPrdWithValidation();

			expect(result.prd).toBeNull();
			expect(result.validationError).toBeDefined();
		});

		test("returns validation error when tasks array is missing", () => {
			writeFileSync(`${RALPH_DIR}/prd.json`, JSON.stringify({ project: "Test" }));

			const result = loadPrdWithValidation();

			expect(result.prd).toBeNull();
			expect(result.validationError).toBeDefined();
		});

		test("returns validation error for invalid JSON", () => {
			writeFileSync(`${RALPH_DIR}/prd.json`, "{ invalid json }");

			const result = loadPrdWithValidation();

			expect(result.prd).toBeNull();
			expect(result.validationError).toContain("Failed to parse");
		});
	});
});

describe("isPrdComplete", () => {
	test("returns true when all tasks are done", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: true },
				{ title: "Task 2", description: "", steps: [], done: true },
			],
		};

		expect(isPrdComplete(prd)).toBe(true);
	});

	test("returns false when any task is not done", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: true },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};

		expect(isPrdComplete(prd)).toBe(false);
	});

	test("returns true for empty tasks array", () => {
		const prd: Prd = { project: "Test", tasks: [] };

		expect(isPrdComplete(prd)).toBe(true);
	});
});

describe("getNextTask", () => {
	test("returns first incomplete task title", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: true },
				{ title: "Task 2", description: "", steps: [], done: false },
				{ title: "Task 3", description: "", steps: [], done: false },
			],
		};

		expect(getNextTask(prd)).toBe("Task 2");
	});

	test("returns null when all tasks are complete", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: true },
				{ title: "Task 2", description: "", steps: [], done: true },
			],
		};

		expect(getNextTask(prd)).toBeNull();
	});

	test("returns null for empty tasks array", () => {
		const prd: Prd = { project: "Test", tasks: [] };

		expect(getNextTask(prd)).toBeNull();
	});
});

describe("getNextTaskWithIndex", () => {
	test("returns task with index for first incomplete task", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: true },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = getNextTaskWithIndex(prd);

		expect(result).not.toBeNull();
		expect(result?.title).toBe("Task 2");
		expect(result?.index).toBe(1);
	});

	test("returns null when all tasks are complete", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: true }],
		};

		expect(getNextTaskWithIndex(prd)).toBeNull();
	});
});

describe("getTaskByTitle", () => {
	test("finds task by exact title", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task One", description: "First", steps: [], done: false },
				{ title: "Task Two", description: "Second", steps: [], done: false },
			],
		};
		const result = getTaskByTitle(prd, "Task One");

		expect(result).not.toBeNull();
		expect(result?.description).toBe("First");
	});

	test("finds task case-insensitively", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task One", description: "First", steps: [], done: false }],
		};
		const result = getTaskByTitle(prd, "task one");

		expect(result).not.toBeNull();
		expect(result?.title).toBe("Task One");
	});

	test("returns null when task not found", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task One", description: "", steps: [], done: false }],
		};

		expect(getTaskByTitle(prd, "Nonexistent")).toBeNull();
	});
});

describe("getTaskByIndex", () => {
	test("returns task at valid index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = getTaskByIndex(prd, 1);

		expect(result?.title).toBe("Task 2");
	});

	test("returns null for negative index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};

		expect(getTaskByIndex(prd, -1)).toBeNull();
	});

	test("returns null for out of bounds index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};

		expect(getTaskByIndex(prd, 5)).toBeNull();
	});
});

describe("canWorkOnTask", () => {
	test("returns canWork true for incomplete task", () => {
		const task: PrdTask = { title: "Task", description: "", steps: [], done: false };
		const result = canWorkOnTask(task);

		expect(result.canWork).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	test("returns canWork false for completed task", () => {
		const task: PrdTask = { title: "Task", description: "", steps: [], done: true };
		const result = canWorkOnTask(task);

		expect(result.canWork).toBe(false);
		expect(result.reason).toContain("already completed");
	});
});

describe("createEmptyPrd", () => {
	test("creates PRD with project name and empty tasks", () => {
		const prd = createEmptyPrd("My Project");

		expect(prd.project).toBe("My Project");
		expect(prd.tasks).toEqual([]);
	});
});
