import {
	type ActiveTaskExecution,
	type ParallelExecutionGroup,
	type ParallelSessionState,
	type Session,
	type SessionStatus,
	type TaskExecutionStatus,
	VALID_SESSION_STATUSES,
	VALID_TASK_EXECUTION_STATUSES,
} from "./types.ts";

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

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

export function isSessionStatus(value: unknown): value is SessionStatus {
	return isString(value) && VALID_SESSION_STATUSES.includes(value as SessionStatus);
}

export function isTaskExecutionStatus(value: unknown): value is TaskExecutionStatus {
	return isString(value) && VALID_TASK_EXECUTION_STATUSES.includes(value as TaskExecutionStatus);
}

export function isActiveTaskExecution(value: unknown): value is ActiveTaskExecution {
	if (!isObject(value)) {
		return false;
	}

	const { taskId, taskTitle, taskIndex, status, startTime, processId, retryCount } = value;

	if (!isString(taskId) || !isString(taskTitle)) {
		return false;
	}

	if (!isNumber(taskIndex) || !isNumber(startTime)) {
		return false;
	}

	if (!isTaskExecutionStatus(status)) {
		return false;
	}

	if (!isString(processId) || !isNumber(retryCount)) {
		return false;
	}

	return true;
}

export function isParallelExecutionGroup(value: unknown): value is ParallelExecutionGroup {
	if (!isObject(value)) {
		return false;
	}

	const { groupIndex, startTime, taskExecutions, isComplete } = value;

	if (!isNumber(groupIndex) || !isNumber(startTime)) {
		return false;
	}

	if (!isBoolean(isComplete)) {
		return false;
	}

	if (!isArray(taskExecutions)) {
		return false;
	}

	return taskExecutions.every((execution) => isActiveTaskExecution(execution));
}

export function isParallelSessionState(value: unknown): value is ParallelSessionState {
	if (!isObject(value)) {
		return false;
	}

	const {
		isParallelMode,
		currentGroupIndex,
		executionGroups,
		activeExecutions,
		maxConcurrentTasks,
	} = value;

	if (!isBoolean(isParallelMode)) {
		return false;
	}

	if (!isNumber(currentGroupIndex) || !isNumber(maxConcurrentTasks)) {
		return false;
	}

	if (!isArray(executionGroups) || !isArray(activeExecutions)) {
		return false;
	}

	const isValidGroups = executionGroups.every((group) => isParallelExecutionGroup(group));
	const isValidExecutions = activeExecutions.every((execution) => isActiveTaskExecution(execution));

	return isValidGroups && isValidExecutions;
}

export function isSession(value: unknown): value is Session {
	if (!isObject(value)) {
		return false;
	}

	const {
		startTime,
		lastUpdateTime,
		currentIteration,
		totalIterations,
		currentTaskIndex,
		status,
		elapsedTimeSeconds,
		statistics,
		parallelState,
	} = value;

	if (!isNumber(startTime) || !isNumber(lastUpdateTime)) {
		return false;
	}

	if (!isNumber(currentIteration) || !isNumber(totalIterations)) {
		return false;
	}

	if (!isNumber(currentTaskIndex) || !isNumber(elapsedTimeSeconds)) {
		return false;
	}

	if (!isSessionStatus(status)) {
		return false;
	}

	if (!isObject(statistics)) {
		return false;
	}

	if (parallelState !== undefined && !isParallelSessionState(parallelState)) {
		return false;
	}

	return true;
}
