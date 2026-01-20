import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { DecompositionHandler } from "@/lib/handlers/DecompositionHandler.ts";
import { ensureRalphDirExists, PRD_JSON_PATH } from "@/lib/paths.ts";
import { reloadPrd } from "@/lib/prd.ts";
import type { DecompositionRequest, Prd, RalphConfig } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-decomposition-handler";

function writePrdFile(prd: Prd): void {
	ensureRalphDirExists();
	writeFileSync(PRD_JSON_PATH, JSON.stringify(prd, null, 2));
}

describe("DecompositionHandler", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(`${TEST_DIR}/.ralph`, { recursive: true });
		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	test("applies decomposition and restarts iteration", () => {
		const prd: Prd = {
			project: "Test Project",
			tasks: [
				{
					title: "Original Task",
					description: "Test task",
					steps: [],
					done: false,
				},
			],
		};

		writePrdFile(prd);

		const config: RalphConfig = {
			agent: "cursor",
			maxDecompositionsPerTask: 1,
		};

		const request: DecompositionRequest = {
			originalTaskTitle: "Original Task",
			reason: "Need smaller tasks",
			suggestedSubtasks: [
				{
					title: "Subtask A",
					description: "First subtask",
					steps: ["Step 1"],
				},
				{
					title: "Subtask B",
					description: "Second subtask",
					steps: ["Step 2"],
				},
			],
		};

		let updatedPrd: Prd | null = null;
		let restartCalled = false;

		const handler = new DecompositionHandler({
			config,
			onPrdUpdate: (nextPrd) => {
				updatedPrd = nextPrd;
			},
			onRestartIteration: () => {
				restartCalled = true;
			},
		});

		const currentPrd = reloadPrd();
		const handled = handler.handle(request, currentPrd);

		expect(handled).toBe(true);
		expect(restartCalled).toBe(true);
		expect(updatedPrd).not.toBeNull();
		const updatedPrdSnapshot = updatedPrd as unknown as Prd;

		expect(updatedPrdSnapshot.tasks.length).toBe(2);
		expect(updatedPrdSnapshot.tasks[0]?.title).toBe("Subtask A");
		expect(updatedPrdSnapshot.tasks[1]?.title).toBe("Subtask B");

		const secondAttempt = handler.handle(request, currentPrd);

		expect(secondAttempt).toBe(false);
	});
});
