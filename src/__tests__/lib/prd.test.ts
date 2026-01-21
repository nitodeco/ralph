import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import {
	canWorkOnTask,
	createEmptyPrd,
	deleteTask,
	findPrdFile,
	getNextTask,
	getNextTaskWithIndex,
	getTaskByIndex,
	getTaskByTitle,
	invalidatePrdCache,
	isPrdComplete,
	loadPrdWithValidation,
	reorderTask,
	toggleTaskDone,
} from "@/lib/prd.ts";
import {
	bootstrapTestServices,
	createPrdService,
	teardownTestServices,
} from "@/lib/services/index.ts";
import type { Prd, PrdTask } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-prd";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("prd functions", () => {
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
		invalidatePrdCache();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		teardownTestServices();

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

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
	beforeEach(() => {
		bootstrapTestServices({ prd: createPrdService() });
	});

	afterEach(() => {
		teardownTestServices();
	});

	test("creates PRD with project name and empty tasks", () => {
		const prd = createEmptyPrd("My Project");

		expect(prd.project).toBe("My Project");
		expect(prd.tasks).toEqual([]);
	});
});

describe("toggleTaskDone", () => {
	test("toggles task from not done to done", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = toggleTaskDone(prd, 0);

		expect(result.tasks.at(0)?.done).toBe(true);
	});

	test("toggles task from done to not done", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: true }],
		};
		const result = toggleTaskDone(prd, 0);

		expect(result.tasks.at(0)?.done).toBe(false);
	});

	test("returns same prd for invalid index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = toggleTaskDone(prd, 5);

		expect(result).toBe(prd);
	});

	test("returns new prd object (immutable)", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = toggleTaskDone(prd, 0);

		expect(result).not.toBe(prd);
		expect(result.tasks).not.toBe(prd.tasks);
		expect(prd.tasks.at(0)?.done).toBe(false);
	});

	test("only toggles the specified task", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
				{ title: "Task 3", description: "", steps: [], done: true },
			],
		};
		const result = toggleTaskDone(prd, 1);

		expect(result.tasks.at(0)?.done).toBe(false);
		expect(result.tasks.at(1)?.done).toBe(true);
		expect(result.tasks.at(2)?.done).toBe(true);
	});
});

describe("deleteTask", () => {
	test("deletes task at valid index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = deleteTask(prd, 0);

		expect(result.tasks).toHaveLength(1);
		expect(result.tasks.at(0)?.title).toBe("Task 2");
	});

	test("returns same prd for negative index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = deleteTask(prd, -1);

		expect(result).toBe(prd);
	});

	test("returns same prd for out of bounds index", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = deleteTask(prd, 5);

		expect(result).toBe(prd);
	});

	test("returns new prd object (immutable)", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = deleteTask(prd, 0);

		expect(result).not.toBe(prd);
		expect(result.tasks).not.toBe(prd.tasks);
		expect(prd.tasks).toHaveLength(2);
	});

	test("deletes last task", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = deleteTask(prd, 1);

		expect(result.tasks).toHaveLength(1);
		expect(result.tasks.at(0)?.title).toBe("Task 1");
	});
});

describe("reorderTask", () => {
	test("moves task from beginning to end", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
				{ title: "Task 3", description: "", steps: [], done: false },
			],
		};
		const result = reorderTask(prd, 0, 2);

		expect(result.tasks.at(0)?.title).toBe("Task 2");
		expect(result.tasks.at(1)?.title).toBe("Task 3");
		expect(result.tasks.at(2)?.title).toBe("Task 1");
	});

	test("moves task from end to beginning", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
				{ title: "Task 3", description: "", steps: [], done: false },
			],
		};
		const result = reorderTask(prd, 2, 0);

		expect(result.tasks.at(0)?.title).toBe("Task 3");
		expect(result.tasks.at(1)?.title).toBe("Task 1");
		expect(result.tasks.at(2)?.title).toBe("Task 2");
	});

	test("moves task to middle position", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
				{ title: "Task 3", description: "", steps: [], done: false },
			],
		};
		const result = reorderTask(prd, 0, 1);

		expect(result.tasks.at(0)?.title).toBe("Task 2");
		expect(result.tasks.at(1)?.title).toBe("Task 1");
		expect(result.tasks.at(2)?.title).toBe("Task 3");
	});

	test("returns same prd when fromIndex equals toIndex", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = reorderTask(prd, 0, 0);

		expect(result).toBe(prd);
	});

	test("returns same prd for negative fromIndex", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = reorderTask(prd, -1, 0);

		expect(result).toBe(prd);
	});

	test("returns same prd for out of bounds fromIndex", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = reorderTask(prd, 5, 0);

		expect(result).toBe(prd);
	});

	test("returns same prd for negative toIndex", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = reorderTask(prd, 0, -1);

		expect(result).toBe(prd);
	});

	test("returns same prd for out of bounds toIndex", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [{ title: "Task 1", description: "", steps: [], done: false }],
		};
		const result = reorderTask(prd, 0, 5);

		expect(result).toBe(prd);
	});

	test("returns new prd object (immutable)", () => {
		const prd: Prd = {
			project: "Test",
			tasks: [
				{ title: "Task 1", description: "", steps: [], done: false },
				{ title: "Task 2", description: "", steps: [], done: false },
			],
		};
		const result = reorderTask(prd, 0, 1);

		expect(result).not.toBe(prd);
		expect(result.tasks).not.toBe(prd.tasks);
		expect(prd.tasks.at(0)?.title).toBe("Task 1");
		expect(prd.tasks.at(1)?.title).toBe("Task 2");
	});
});
