import type { DecompositionRequest, DecompositionSubtask, Prd, PrdTask } from "@/types.ts";
import {
	DECOMPOSITION_MARKER,
	DECOMPOSITION_OUTPUT_END,
	DECOMPOSITION_OUTPUT_START,
} from "./prompt.ts";

export interface DecompositionResult {
	detected: boolean;
	request: DecompositionRequest | null;
	error?: string;
}

export function parseDecompositionRequest(output: string): DecompositionResult {
	if (!output.includes(DECOMPOSITION_MARKER)) {
		return { detected: false, request: null };
	}

	const startIndex = output.indexOf(DECOMPOSITION_OUTPUT_START);
	const endIndex = output.indexOf(DECOMPOSITION_OUTPUT_END);

	if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
		return {
			detected: true,
			request: null,
			error: "Decomposition marker found but JSON payload is missing or malformed",
		};
	}

	const jsonContent = output
		.substring(startIndex + DECOMPOSITION_OUTPUT_START.length, endIndex)
		.trim();

	try {
		const parsed = JSON.parse(jsonContent) as unknown;

		if (!isValidDecompositionRequest(parsed)) {
			return {
				detected: true,
				request: null,
				error: "Invalid decomposition request structure",
			};
		}

		return { detected: true, request: parsed };
	} catch (parseError) {
		return {
			detected: true,
			request: null,
			error: `Failed to parse decomposition JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
		};
	}
}

function isValidDecompositionRequest(value: unknown): value is DecompositionRequest {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	if (typeof obj.originalTaskTitle !== "string" || obj.originalTaskTitle.trim() === "") {
		return false;
	}

	if (typeof obj.reason !== "string" || obj.reason.trim() === "") {
		return false;
	}

	if (!Array.isArray(obj.suggestedSubtasks) || obj.suggestedSubtasks.length === 0) {
		return false;
	}

	for (const subtask of obj.suggestedSubtasks) {
		if (!isValidSubtask(subtask)) {
			return false;
		}
	}

	return true;
}

function isValidSubtask(value: unknown): value is DecompositionSubtask {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	if (typeof obj.title !== "string" || obj.title.trim() === "") {
		return false;
	}

	if (typeof obj.description !== "string") {
		return false;
	}

	if (!Array.isArray(obj.steps)) {
		return false;
	}

	for (const step of obj.steps) {
		if (typeof step !== "string") {
			return false;
		}
	}

	return true;
}

export interface ApplyDecompositionResult {
	success: boolean;
	updatedPrd: Prd | null;
	subtasksCreated: number;
	error?: string;
}

export function applyDecomposition(
	prd: Prd,
	request: DecompositionRequest,
): ApplyDecompositionResult {
	const originalTaskIndex = prd.tasks.findIndex(
		(task) => task.title.toLowerCase() === request.originalTaskTitle.toLowerCase(),
	);

	if (originalTaskIndex === -1) {
		return {
			success: false,
			updatedPrd: null,
			subtasksCreated: 0,
			error: `Original task "${request.originalTaskTitle}" not found in PRD`,
		};
	}

	const originalTask = prd.tasks[originalTaskIndex];

	if (originalTask?.done) {
		return {
			success: false,
			updatedPrd: null,
			subtasksCreated: 0,
			error: `Original task "${request.originalTaskTitle}" is already marked as done`,
		};
	}

	const newSubtasks: PrdTask[] = request.suggestedSubtasks.map((subtask) => ({
		title: subtask.title,
		description: subtask.description,
		steps: subtask.steps,
		done: false,
	}));

	const updatedTasks = [
		...prd.tasks.slice(0, originalTaskIndex),
		...newSubtasks,
		...prd.tasks.slice(originalTaskIndex + 1),
	];

	const updatedPrd: Prd = {
		...prd,
		tasks: updatedTasks,
	};

	return {
		success: true,
		updatedPrd,
		subtasksCreated: newSubtasks.length,
	};
}

export function formatDecompositionForProgress(request: DecompositionRequest): string {
	const lines: string[] = [
		"=== Task Decomposition ===",
		`Original task: ${request.originalTaskTitle}`,
		`Reason: ${request.reason}`,
		`Subtasks created: ${request.suggestedSubtasks.length}`,
	];

	for (let subtaskIndex = 0; subtaskIndex < request.suggestedSubtasks.length; subtaskIndex++) {
		const subtask = request.suggestedSubtasks[subtaskIndex];

		if (subtask) {
			lines.push(`  ${subtaskIndex + 1}. ${subtask.title}`);
		}
	}

	lines.push("");

	return lines.join("\n");
}
