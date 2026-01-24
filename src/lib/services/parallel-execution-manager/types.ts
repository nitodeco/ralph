import type { RalphConfig } from "@/types.ts";
import type { Prd, PrdTask } from "../prd/types.ts";

export interface ParallelExecutionConfig {
	enabled: boolean;
	maxConcurrentTasks: number;
}

export interface ParallelGroupState {
	groupIndex: number;
	tasks: PrdTask[];
	completedTaskIds: Set<string>;
	failedTaskIds: Set<string>;
	startTime: number;
}

export interface ParallelTaskResult {
	taskId: string;
	taskTitle: string;
	success: boolean;
	error: string | null;
}

export interface StartGroupResult {
	started: boolean;
	groupIndex: number;
	tasks: PrdTask[];
}

export interface RecordTaskCompleteResult {
	groupComplete: boolean;
	allSucceeded: boolean;
}

export interface ParallelExecutionSummary {
	totalGroups: number;
	completedGroups: number;
	currentGroupIndex: number;
	isActive: boolean;
}

export interface ParallelExecutionManager {
	isEnabled(): boolean;
	getConfig(): ParallelExecutionConfig;
	getCurrentGroup(): ParallelGroupState | null;
	getExecutionGroups(): PrdTask[][];

	setRalphConfig(config: RalphConfig): void;
	initialize(prd: Prd, config: ParallelExecutionConfig): { isValid: boolean; error?: string };
	startNextGroup(): StartGroupResult;
	recordTaskStart(task: PrdTask, processId: string): void;
	recordTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): RecordTaskCompleteResult;
	getReadyTasks(): PrdTask[];
	hasMoreGroups(): boolean;
	getSummary(): ParallelExecutionSummary;
	disable(): void;
	reset(): void;
}
