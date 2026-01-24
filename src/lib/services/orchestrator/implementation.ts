import { eventBus } from "@/lib/events.ts";
import type { RalphConfig } from "@/types.ts";
import type { BranchModeConfig } from "../config/types.ts";
import {
	getBranchModeManager,
	getHandlerCoordinator,
	getIterationCoordinator,
	getParallelExecutionManager,
	getSessionManager,
} from "../container.ts";
import type {
	ParallelExecutionConfig,
	ParallelExecutionSummary,
	ParallelGroupState,
} from "../parallel-execution-manager/types.ts";
import type { Prd, PrdTask } from "../prd/types.ts";
import type { Session } from "../session/types.ts";
import type { ResumeSessionResult, StartSessionResult } from "../session-manager/types.ts";
import type { Orchestrator, OrchestratorCallbacks, OrchestratorConfig } from "./types.ts";

export function createOrchestrator(): Orchestrator {
	let config: RalphConfig | null = null;
	let iterations = 0;
	let skipVerification = false;
	let initialized = false;
	let parallelConfig: ParallelExecutionConfig = { enabled: false, maxConcurrentTasks: 1 };

	function initialize(
		options: OrchestratorConfig,
		orchestratorCallbacks: OrchestratorCallbacks,
	): void {
		if (initialized) {
			cleanup();
		}

		config = options.config;
		iterations = options.iterations;
		skipVerification = options.skipVerification ?? false;
		parallelConfig = options.parallelExecution ?? { enabled: false, maxConcurrentTasks: 1 };
		initialized = true;

		const branchModeManager = getBranchModeManager();
		const branchModeEnabled =
			options.config.workflowMode === "branches" || (options.config.branchMode?.enabled ?? false);

		branchModeManager.setEnabled(branchModeEnabled);
		branchModeManager.setConfig(options.config.branchMode ?? null);

		const handlerCoordinator = getHandlerCoordinator();

		handlerCoordinator.initialize(
			{
				config: options.config,
				skipVerification,
			},
			{
				onPrdUpdate: orchestratorCallbacks.onPrdUpdate,
				onRestartIteration: orchestratorCallbacks.onRestartIteration,
				onVerificationStateChange: orchestratorCallbacks.onVerificationStateChange,
				onIterationComplete: orchestratorCallbacks.onIterationComplete,
				onFatalError: orchestratorCallbacks.onFatalError,
				onAppStateChange: orchestratorCallbacks.onAppStateChange,
			},
		);

		orchestratorCallbacks.setMaxRuntimeMs(options.maxRuntimeMs);
	}

	function getIsVerifying(): boolean {
		return getHandlerCoordinator().getIsVerifying();
	}

	function isBranchModeEnabled(): boolean {
		return getBranchModeManager().isEnabled();
	}

	function getBranchModeConfig(): BranchModeConfig | null {
		return getBranchModeManager().getConfig();
	}

	function getCurrentTaskBranch(): string | null {
		return getBranchModeManager().getCurrentTaskBranch();
	}

	function getBaseBranch(): string | null {
		return getBranchModeManager().getBaseBranch();
	}

	function initializeBranchMode(): { isValid: boolean; error?: string } {
		return getBranchModeManager().initialize();
	}

	function createTaskBranch(
		taskTitle: string,
		taskIndex: number,
	): { success: boolean; error?: string } {
		return getBranchModeManager().createTaskBranch(taskTitle, taskIndex);
	}

	async function completeTaskBranch(
		prd: Prd | null,
	): Promise<{ success: boolean; error?: string; prUrl?: string }> {
		return getBranchModeManager().completeTaskBranch(prd);
	}

	async function createPullRequestForBranch(
		branchName: string,
		prd: Prd | null,
	): Promise<{ success: boolean; prUrl?: string; error?: string }> {
		return getBranchModeManager().createPullRequestForBranch(branchName, prd);
	}

	function isParallelModeEnabled(): boolean {
		return parallelConfig.enabled;
	}

	function getParallelConfig(): ParallelExecutionConfig {
		return { ...parallelConfig };
	}

	function getCurrentParallelGroup(): ParallelGroupState | null {
		return getParallelExecutionManager().getCurrentGroup();
	}

	function getParallelExecutionGroups(): PrdTask[][] {
		return getParallelExecutionManager().getExecutionGroups();
	}

	function initializeParallelExecution(prd: Prd): { isValid: boolean; error?: string } {
		return getParallelExecutionManager().initialize(prd, parallelConfig);
	}

	function startNextParallelGroup(): { started: boolean; groupIndex: number; tasks: PrdTask[] } {
		return getParallelExecutionManager().startNextGroup();
	}

	function recordParallelTaskStart(task: PrdTask, processId: string): void {
		getParallelExecutionManager().recordTaskStart(task, processId);
	}

	function recordParallelTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): { groupComplete: boolean; allSucceeded: boolean } {
		return getParallelExecutionManager().recordTaskComplete(
			taskId,
			taskTitle,
			wasSuccessful,
			error,
		);
	}

	function getReadyTasksForParallelExecution(): PrdTask[] {
		return getParallelExecutionManager().getReadyTasks();
	}

	function hasMoreParallelGroups(): boolean {
		return getParallelExecutionManager().hasMoreGroups();
	}

	function getParallelExecutionSummary(): ParallelExecutionSummary {
		return getParallelExecutionManager().getSummary();
	}

	function disableParallelExecution(): void {
		parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		getParallelExecutionManager().disable();
	}

	function getConfig(): RalphConfig | null {
		return config;
	}

	function setupIterationCallbacks(): void {
		if (!config) {
			throw new Error("Orchestrator must be initialized before setting up iteration callbacks");
		}

		const branchModeManager = getBranchModeManager();

		getIterationCoordinator().setupIterationCallbacks({
			iterations,
			config,
			skipVerification,
			branchModeEnabled: branchModeManager.isEnabled(),
			branchModeConfig: branchModeManager.getConfig(),
		});
	}

	function startSession(prd: Prd | null, totalIterations: number): StartSessionResult {
		return getSessionManager().startSession(prd, totalIterations);
	}

	function resumeSession(pendingSession: Session, prd: Prd | null): ResumeSessionResult {
		return getSessionManager().resumeSession(pendingSession, prd);
	}

	function handleFatalError(
		error: string,
		prd: Prd | null,
		currentSession: Session | null,
	): Session | null {
		const result = getSessionManager().handleFatalError(error, prd, currentSession);

		return result.session;
	}

	function cleanup(): void {
		initialized = false;

		getHandlerCoordinator().cleanup();
		getIterationCoordinator().clearState();
		getParallelExecutionManager().reset();
		getBranchModeManager().reset();

		parallelConfig = { enabled: false, maxConcurrentTasks: 1 };

		eventBus.removeAllListeners();
	}

	return {
		initialize,
		setupIterationCallbacks,
		getConfig,
		getIsVerifying,
		isBranchModeEnabled,
		getBranchModeConfig,
		getCurrentTaskBranch,
		getBaseBranch,
		initializeBranchMode,
		createTaskBranch,
		completeTaskBranch,
		createPullRequestForBranch,
		isParallelModeEnabled,
		getParallelConfig,
		getCurrentParallelGroup,
		getParallelExecutionGroups,
		initializeParallelExecution,
		startNextParallelGroup,
		recordParallelTaskStart,
		recordParallelTaskComplete,
		getReadyTasksForParallelExecution,
		hasMoreParallelGroups,
		getParallelExecutionSummary,
		disableParallelExecution,
		startSession,
		resumeSession,
		handleFatalError,
		cleanup,
	};
}
