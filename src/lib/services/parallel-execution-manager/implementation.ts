import {
	getParallelExecutionGroups,
	getReadyTasks,
	validateDependencies,
} from "@/lib/dependency-graph.ts";
import { getLogger } from "@/lib/logger.ts";
import { appendProgress } from "@/lib/progress.ts";
import type { RalphConfig } from "@/types.ts";
import { getConfigService, getPrdService, getSessionService } from "../container.ts";
import type { Prd, PrdTask } from "../prd/types.ts";
import type { Session } from "../session/types.ts";
import type {
	ParallelExecutionConfig,
	ParallelExecutionManager,
	ParallelExecutionSummary,
	ParallelGroupState,
	ParallelTaskResult,
	RecordTaskCompleteResult,
	StartGroupResult,
} from "./types.ts";

export interface ParallelExecutionManagerDependencies {
	getAppStoreState: () => {
		prd: Prd | null;
		currentSession: Session | null;
	};
	setAppStoreState: (
		state: Partial<{
			currentSession: Session | null;
		}>,
	) => void;
}

export function createParallelExecutionManager(
	dependencies: ParallelExecutionManagerDependencies,
): ParallelExecutionManager {
	let parallelConfig: ParallelExecutionConfig = { enabled: false, maxConcurrentTasks: 1 };
	let currentParallelGroup: ParallelGroupState | null = null;
	let parallelExecutionGroups: PrdTask[][] = [];
	let currentGroupIndex = 0;
	const parallelTaskResults: Map<string, ParallelTaskResult> = new Map();
	let cachedConfig: RalphConfig | null = null;

	function isEnabled(): boolean {
		return parallelConfig.enabled;
	}

	function getConfig(): ParallelExecutionConfig {
		return { ...parallelConfig };
	}

	function getCurrentGroup(): ParallelGroupState | null {
		return currentParallelGroup;
	}

	function getExecutionGroups(): PrdTask[][] {
		return [...parallelExecutionGroups];
	}

	function setRalphConfig(config: RalphConfig): void {
		cachedConfig = config;
	}

	function initialize(
		prd: Prd,
		config: ParallelExecutionConfig,
	): { isValid: boolean; error?: string } {
		const ralphConfig = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: ralphConfig.logFilePath });

		parallelConfig = config;

		if (!config.enabled) {
			return { isValid: true };
		}

		const validationResult = validateDependencies(prd);

		if (!validationResult.isValid) {
			const errorMessages = validationResult.errors
				.map((err) => `${err.type}: ${err.details}`)
				.join("; ");

			logger.error("Dependency validation failed for parallel execution", {
				errors: validationResult.errors,
			});

			return { isValid: false, error: `Invalid task dependencies: ${errorMessages}` };
		}

		parallelExecutionGroups = getParallelExecutionGroups(prd);
		currentGroupIndex = 0;

		logger.info("Initialized parallel execution", {
			totalGroups: parallelExecutionGroups.length,
			maxConcurrentTasks: config.maxConcurrentTasks,
		});

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const parallelSession = sessionService.enableParallelMode(
				appState.currentSession,
				config.maxConcurrentTasks,
			);

			sessionService.save(parallelSession);
			dependencies.setAppStoreState({ currentSession: parallelSession });
		}

		return { isValid: true };
	}

	function startNextGroup(): StartGroupResult {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		if (currentGroupIndex >= parallelExecutionGroups.length) {
			logger.info("All parallel groups completed");

			return { started: false, groupIndex: -1, tasks: [] };
		}

		const currentGroup = parallelExecutionGroups.at(currentGroupIndex);

		if (!currentGroup || currentGroup.length === 0) {
			logger.warn("Empty parallel group encountered", { groupIndex: currentGroupIndex });
			currentGroupIndex++;

			return startNextGroup();
		}

		const tasksToExecute = currentGroup.slice(0, parallelConfig.maxConcurrentTasks);

		currentParallelGroup = {
			groupIndex: currentGroupIndex,
			tasks: tasksToExecute,
			completedTaskIds: new Set(),
			failedTaskIds: new Set(),
			startTime: Date.now(),
		};

		parallelTaskResults.clear();

		logger.info("Starting parallel group", {
			groupIndex: currentGroupIndex,
			taskCount: tasksToExecute.length,
			taskTitles: tasksToExecute.map((task) => task.title),
		});

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.startParallelGroup(
				appState.currentSession,
				currentGroupIndex,
			);

			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}

		return { started: true, groupIndex: currentGroupIndex, tasks: tasksToExecute };
	}

	function recordTaskStart(task: PrdTask, processId: string): void {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		logger.info("Parallel task started", {
			taskId: task.id,
			taskTitle: task.title,
			processId,
			groupIndex: currentGroupIndex,
		});

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const taskIndex = appState.prd?.tasks.findIndex((t) => t.title === task.title) ?? -1;
			const updatedSession = sessionService.startTaskExecution(appState.currentSession, {
				taskId: task.id ?? `task-${taskIndex}`,
				taskTitle: task.title,
				taskIndex,
				processId,
			});

			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}
	}

	function completeCurrentGroup(): void {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		if (!currentParallelGroup) {
			return;
		}

		const durationMs = Date.now() - currentParallelGroup.startTime;
		const allSucceeded = currentParallelGroup.failedTaskIds.size === 0;

		logger.info("Parallel group completed", {
			groupIndex: currentParallelGroup.groupIndex,
			completedCount: currentParallelGroup.completedTaskIds.size,
			failedCount: currentParallelGroup.failedTaskIds.size,
			durationMs,
			allSucceeded,
		});

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.completeParallelGroup(
				appState.currentSession,
				currentParallelGroup.groupIndex,
			);

			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}

		appendProgress(
			`=== Parallel Group ${currentParallelGroup.groupIndex + 1} Complete ===\n` +
				`Completed: ${currentParallelGroup.completedTaskIds.size}, ` +
				`Failed: ${currentParallelGroup.failedTaskIds.size}, ` +
				`Duration: ${Math.round(durationMs / 1000)}s\n`,
		);

		currentGroupIndex++;
		currentParallelGroup = null;
	}

	function recordTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): RecordTaskCompleteResult {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		if (!currentParallelGroup) {
			logger.warn("No active parallel group when recording task completion", { taskId });

			return { groupComplete: true, allSucceeded: false };
		}

		parallelTaskResults.set(taskId, {
			taskId,
			taskTitle,
			success: wasSuccessful,
			error: error ?? null,
		});

		if (wasSuccessful) {
			currentParallelGroup.completedTaskIds.add(taskId);
		} else {
			currentParallelGroup.failedTaskIds.add(taskId);
		}

		logger.info("Parallel task completed", {
			taskId,
			taskTitle,
			wasSuccessful,
			completedCount: currentParallelGroup.completedTaskIds.size,
			failedCount: currentParallelGroup.failedTaskIds.size,
			totalInGroup: currentParallelGroup.tasks.length,
		});

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = wasSuccessful
				? sessionService.completeTaskExecution(appState.currentSession, taskId, true)
				: sessionService.failTaskExecution(
						appState.currentSession,
						taskId,
						error ?? "Unknown error",
					);

			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}

		const totalCompleted =
			currentParallelGroup.completedTaskIds.size + currentParallelGroup.failedTaskIds.size;
		const isGroupComplete = totalCompleted >= currentParallelGroup.tasks.length;
		const allSucceeded = currentParallelGroup.failedTaskIds.size === 0;

		if (isGroupComplete) {
			completeCurrentGroup();
		}

		return {
			groupComplete: isGroupComplete,
			allSucceeded,
		};
	}

	function getReadyTasksForExecution(): PrdTask[] {
		const prd = getPrdService().reload();

		if (!prd) {
			return [];
		}

		const readyTasks = getReadyTasks(prd);

		return readyTasks
			.filter((taskInfo) => !taskInfo.task.done)
			.map((taskInfo) => taskInfo.task)
			.slice(0, parallelConfig.maxConcurrentTasks);
	}

	function hasMoreGroups(): boolean {
		return currentGroupIndex < parallelExecutionGroups.length;
	}

	function getSummary(): ParallelExecutionSummary {
		return {
			totalGroups: parallelExecutionGroups.length,
			completedGroups: currentGroupIndex,
			currentGroupIndex: currentGroupIndex,
			isActive: currentParallelGroup !== null,
		};
	}

	function disable(): void {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		if (!parallelConfig.enabled) {
			return;
		}

		logger.info("Disabling parallel execution");

		parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		currentParallelGroup = null;
		parallelExecutionGroups = [];
		currentGroupIndex = 0;
		parallelTaskResults.clear();

		const appState = dependencies.getAppStoreState();

		if (appState.currentSession) {
			const sessionService = getSessionService();
			const updatedSession = sessionService.disableParallelMode(appState.currentSession);

			sessionService.save(updatedSession);
			dependencies.setAppStoreState({ currentSession: updatedSession });
		}
	}

	function reset(): void {
		parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		currentParallelGroup = null;
		parallelExecutionGroups = [];
		currentGroupIndex = 0;
		parallelTaskResults.clear();
		cachedConfig = null;
	}

	return {
		isEnabled,
		getConfig,
		getCurrentGroup,
		getExecutionGroups,
		setRalphConfig,
		initialize,
		startNextGroup,
		recordTaskStart,
		recordTaskComplete,
		getReadyTasks: getReadyTasksForExecution,
		hasMoreGroups,
		getSummary,
		disable,
		reset,
	};
}
