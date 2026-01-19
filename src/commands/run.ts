import { existsSync } from "node:fs";
import { runAgent } from "../lib/agent.ts";
import { findPrdFile, PROGRESS_FILE_PATH, RALPH_DIR } from "../lib/prd.ts";

const DEFAULT_ITERATIONS = 10;
const ITERATION_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCommand(iterationsArg?: string): Promise<void> {
	const iterations = iterationsArg ? parseInt(iterationsArg, 10) : DEFAULT_ITERATIONS;

	if (Number.isNaN(iterations) || iterations < 1) {
		console.error("Error: iterations must be a positive number");
		process.exit(1);
	}

	const prdFile = findPrdFile();
	if (!prdFile) {
		console.error(`Error: No prd.json or prd.yaml found in ${RALPH_DIR}/`);
		console.error("Run 'ralph init' to create one");
		process.exit(1);
	}

	if (!existsSync(PROGRESS_FILE_PATH)) {
		console.error(`Error: No ${PROGRESS_FILE_PATH} found`);
		console.error("Run 'ralph init' to create one");
		process.exit(1);
	}

	for (let iteration = 1; iteration <= iterations; iteration++) {
		console.log("");
		console.log(`=== Iteration ${iteration} ===`);
		console.log("");

		const result = await runAgent();

		if (result.isComplete) {
			console.log("");
			console.log("=== All tasks completed! ===");
			console.log("");
			process.exit(0);
		}

		console.log("");
		console.log(`=== Iteration ${iteration} completed ===`);

		if (iteration < iterations) {
			console.log("=== Waiting for next iteration... ===");
			await sleep(ITERATION_DELAY_MS);
		}
	}

	console.log("");
	console.log(`=== Completed ${iterations} iterations. PRD is not completed. ===`);
	console.log("");
	process.exit(1);
}
