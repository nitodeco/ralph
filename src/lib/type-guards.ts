import type {
	GuardrailCategory,
	GuardrailTrigger,
	PromptGuardrail,
	RalphConfig,
} from "@/types/config.types.ts";
import type { Prd, PrdTask } from "@/types/prd.types.ts";
import type {
	FailureHistory,
	FailureHistoryEntry,
	FailurePattern,
	IterationLog,
	IterationLogAgent,
	IterationLogStatus,
	IterationLogsIndex,
	IterationLogsIndexEntry,
} from "@/types/session.types.ts";
import type { StreamJsonMessage } from "./agent-stream.ts";
import { VALID_AGENTS } from "./constants/config.ts";
import type { GuardrailsFile } from "./guardrails.ts";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNumber(value: unknown): value is number {
	return typeof value === "number";
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => isString(item));
}

export function isPrdTask(value: unknown): value is PrdTask {
	if (!isObject(value)) {
		return false;
	}

	const { title, description, steps, done } = value;

	return isString(title) && isString(description) && isStringArray(steps) && isBoolean(done);
}

export function isPrd(value: unknown): value is Prd {
	if (!isObject(value)) {
		return false;
	}

	const { project, tasks } = value;

	if (!isString(project) || project.trim() === "") {
		return false;
	}

	if (!Array.isArray(tasks)) {
		return false;
	}

	return tasks.every((task) => isPrdTask(task));
}

export function isRalphConfig(value: unknown): value is RalphConfig {
	if (!isObject(value)) {
		return false;
	}

	const { agent } = value;

	if (!isString(agent) || !VALID_AGENTS.includes(agent as RalphConfig["agent"])) {
		return false;
	}

	return true;
}

export function isPartialRalphConfig(value: unknown): value is Partial<RalphConfig> {
	if (!isObject(value)) {
		return false;
	}

	const { agent } = value;

	if (
		agent !== undefined &&
		(!isString(agent) || !VALID_AGENTS.includes(agent as RalphConfig["agent"]))
	) {
		return false;
	}

	return true;
}

const VALID_GUARDRAIL_TRIGGERS: GuardrailTrigger[] = ["always", "on-error", "on-task-type"];
const VALID_GUARDRAIL_CATEGORIES: GuardrailCategory[] = ["safety", "quality", "style", "process"];

function isPromptGuardrail(value: unknown): value is PromptGuardrail {
	if (!isObject(value)) {
		return false;
	}

	const { id, instruction, trigger, category, enabled, addedAt } = value;

	if (!isString(id) || !isString(instruction)) {
		return false;
	}

	if (!isString(trigger) || !VALID_GUARDRAIL_TRIGGERS.includes(trigger as GuardrailTrigger)) {
		return false;
	}

	if (!isString(category) || !VALID_GUARDRAIL_CATEGORIES.includes(category as GuardrailCategory)) {
		return false;
	}

	if (!isBoolean(enabled) || !isString(addedAt)) {
		return false;
	}

	return true;
}

export function isGuardrailsFile(value: unknown): value is GuardrailsFile {
	if (!isObject(value)) {
		return false;
	}

	const { guardrails } = value;

	if (!Array.isArray(guardrails)) {
		return false;
	}

	return guardrails.every((guardrail) => isPromptGuardrail(guardrail));
}

export function isStreamJsonMessage(value: unknown): value is StreamJsonMessage {
	if (!isObject(value)) {
		return false;
	}

	const { type } = value;

	if (!isString(type)) {
		return false;
	}

	return true;
}

const VALID_ITERATION_LOG_STATUSES: IterationLogStatus[] = [
	"running",
	"completed",
	"failed",
	"stopped",
	"verification_failed",
	"decomposed",
];

function isIterationLogStatus(value: unknown): value is IterationLogStatus {
	return isString(value) && VALID_ITERATION_LOG_STATUSES.includes(value as IterationLogStatus);
}

function isIterationLogsIndexEntry(value: unknown): value is IterationLogsIndexEntry {
	if (!isObject(value)) {
		return false;
	}

	const { iteration, status, filename } = value;

	return isNumber(iteration) && isIterationLogStatus(status) && isString(filename);
}

export function isIterationLogsIndex(value: unknown): value is IterationLogsIndex {
	if (!isObject(value)) {
		return false;
	}

	const { sessionId, projectName, startedAt, lastUpdatedAt, iterations } = value;

	if (!isString(sessionId) || !isString(projectName)) {
		return false;
	}

	if (!isString(startedAt) || !isString(lastUpdatedAt)) {
		return false;
	}

	if (!Array.isArray(iterations)) {
		return false;
	}

	return iterations.every((entry) => isIterationLogsIndexEntry(entry));
}

function isIterationLogAgent(value: unknown): value is IterationLogAgent {
	if (!isObject(value)) {
		return false;
	}

	const { type, exitCode, retryCount, outputLength } = value;

	if (!isString(type)) {
		return false;
	}

	if (exitCode !== null && !isNumber(exitCode)) {
		return false;
	}

	if (!isNumber(retryCount) || !isNumber(outputLength)) {
		return false;
	}

	return true;
}

export function isIterationLog(value: unknown): value is IterationLog {
	if (!isObject(value)) {
		return false;
	}

	const { iteration, totalIterations, startedAt, status, agent, errors } = value;

	if (!isNumber(iteration) || !isNumber(totalIterations)) {
		return false;
	}

	if (!isString(startedAt) || !isIterationLogStatus(status)) {
		return false;
	}

	if (!isIterationLogAgent(agent)) {
		return false;
	}

	if (!Array.isArray(errors)) {
		return false;
	}

	return true;
}

function isFailureHistoryEntry(value: unknown): value is FailureHistoryEntry {
	if (!isObject(value)) {
		return false;
	}

	const { timestamp, error, taskTitle, category, rootCause, iteration } = value;

	if (!isString(timestamp) || !isString(error)) {
		return false;
	}

	if (!isString(taskTitle) || !isString(category) || !isString(rootCause)) {
		return false;
	}

	if (!isNumber(iteration)) {
		return false;
	}

	return true;
}

function isFailurePattern(value: unknown): value is FailurePattern {
	if (!isObject(value)) {
		return false;
	}

	const { pattern, category, occurrences, firstSeen, lastSeen, affectedTasks, resolved } = value;

	if (!isString(pattern) || !isString(category)) {
		return false;
	}

	if (!isNumber(occurrences) || !isString(firstSeen) || !isString(lastSeen)) {
		return false;
	}

	if (!isStringArray(affectedTasks) || !isBoolean(resolved)) {
		return false;
	}

	return true;
}

export function isFailureHistory(value: unknown): value is FailureHistory {
	if (!isObject(value)) {
		return false;
	}

	const { entries, patterns, lastAnalyzedAt } = value;

	if (!Array.isArray(entries) || !entries.every((entry) => isFailureHistoryEntry(entry))) {
		return false;
	}

	if (!Array.isArray(patterns) || !patterns.every((pattern) => isFailurePattern(pattern))) {
		return false;
	}

	if (lastAnalyzedAt !== null && !isString(lastAnalyzedAt)) {
		return false;
	}

	return true;
}
