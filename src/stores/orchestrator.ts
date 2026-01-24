import { eventBus } from "@/lib/events.ts";
import type { BranchModeConfig } from "@/lib/services/config/types.ts";
import {
	getBranchModeManager,
	getHandlerCoordinator,
	getIterationCoordinator,
	getParallelExecutionManager,
	getSessionManager,
} from "@/lib/services/index.ts";
import type {
	ParallelExecutionConfig,
	ParallelExecutionSummary,
	ParallelGroupState,
} from "@/lib/services/parallel-execution-manager/types.ts";
import type { PrdTask } from "@/lib/services/prd/types.ts";
import type { Prd, RalphConfig, Session } from "@/types.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

export type {
	ParallelExecutionConfig,
	ParallelExecutionSummary,
	ParallelGroupState,
} from "@/lib/services/parallel-execution-manager/types.ts";
export type {
	ResumeSessionResult,
	StartSessionResult,
} from "@/lib/services/session-manager/types.ts";

interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
	parallelExecution?: ParallelExecutionConfig;
}

class SessionOrchestrator {
	private config: RalphConfig | null = null;
	private iterations = 0;
	private maxRuntimeMs: number | undefined = undefined;
	private skipVerification = false;
	private initialized = false;

	private parallelConfig: ParallelExecutionConfig = { enabled: false, maxConcurrentTasks: 1 };

	initialize(options: OrchestratorConfig): void {
		if (this.initialized) {
			this.cleanup();
		}

		this.config = options.config;
		this.iterations = options.iterations;
		this.maxRuntimeMs = options.maxRuntimeMs;
		this.skipVerification = options.skipVerification ?? false;
		this.parallelConfig = options.parallelExecution ?? { enabled: false, maxConcurrentTasks: 1 };
		this.initialized = true;

		const branchModeManager = getBranchModeManager();
		const branchModeEnabled =
			options.config.workflowMode === "branches" || (options.config.branchMode?.enabled ?? false);

		branchModeManager.setEnabled(branchModeEnabled);
		branchModeManager.setConfig(options.config.branchMode ?? null);

		const handlerCoordinator = getHandlerCoordinator();

		handlerCoordinator.initialize(
			{
				config: options.config,
				skipVerification: this.skipVerification,
			},
			{
				onPrdUpdate: (prd) => {
					useAppStore.setState({ prd });
				},
				onRestartIteration: () => {
					useIterationStore.getState().restartCurrentIteration();
				},
				onVerificationStateChange: (isVerifying, result) => {
					useAppStore.setState({ isVerifying, lastVerificationResult: result });
				},
				onIterationComplete: (allTasksDone, hasPendingTasks) => {
					const iterationStore = useIterationStore.getState();

					iterationStore.markIterationComplete(allTasksDone, hasPendingTasks);
				},
				onFatalError: (error, prd, currentSession) => {
					this.handleFatalError(error, prd, currentSession);
				},
				onAppStateChange: (state) => {
					useAppStore.setState({ appState: state });
				},
			},
		);

		const iterationStore = useIterationStore.getState();

		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
	}

	getIsVerifying(): boolean {
		return getHandlerCoordinator().getIsVerifying();
	}

	isBranchModeEnabled(): boolean {
		return getBranchModeManager().isEnabled();
	}

	getBranchModeConfig(): BranchModeConfig | null {
		return getBranchModeManager().getConfig();
	}

	getCurrentTaskBranch(): string | null {
		return getBranchModeManager().getCurrentTaskBranch();
	}

	getBaseBranch(): string | null {
		return getBranchModeManager().getBaseBranch();
	}

	initializeBranchMode(): { isValid: boolean; error?: string } {
		return getBranchModeManager().initialize();
	}

	createTaskBranch(taskTitle: string, taskIndex: number): { success: boolean; error?: string } {
		return getBranchModeManager().createTaskBranch(taskTitle, taskIndex);
	}

	async completeTaskBranch(
		prd: Prd | null,
	): Promise<{ success: boolean; error?: string; prUrl?: string }> {
		return getBranchModeManager().completeTaskBranch(prd);
	}

	async createPullRequestForBranch(
		branchName: string,
		prd: Prd | null,
	): Promise<{ success: boolean; prUrl?: string; error?: string }> {
		return getBranchModeManager().createPullRequestForBranch(branchName, prd);
	}

	isParallelModeEnabled(): boolean {
		return this.parallelConfig.enabled;
	}

	getParallelConfig(): ParallelExecutionConfig {
		return { ...this.parallelConfig };
	}

	getCurrentParallelGroup(): ParallelGroupState | null {
		return getParallelExecutionManager().getCurrentGroup();
	}

	getParallelExecutionGroups(): PrdTask[][] {
		return getParallelExecutionManager().getExecutionGroups();
	}

	initializeParallelExecution(prd: Prd): { isValid: boolean; error?: string } {
		return getParallelExecutionManager().initialize(prd, this.parallelConfig);
	}

	startNextParallelGroup(): { started: boolean; groupIndex: number; tasks: PrdTask[] } {
		return getParallelExecutionManager().startNextGroup();
	}

	recordParallelTaskStart(task: PrdTask, processId: string): void {
		getParallelExecutionManager().recordTaskStart(task, processId);
	}

	recordParallelTaskComplete(
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

	getReadyTasksForParallelExecution(): PrdTask[] {
		return getParallelExecutionManager().getReadyTasks();
	}

	hasMoreParallelGroups(): boolean {
		return getParallelExecutionManager().hasMoreGroups();
	}

	getParallelExecutionSummary(): ParallelExecutionSummary {
		return getParallelExecutionManager().getSummary();
	}

	disableParallelExecution(): void {
		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };
		getParallelExecutionManager().disable();
	}

	getConfig(): RalphConfig | null {
		return this.config;
	}

	setupIterationCallbacks(): void {
		if (!this.config) {
			throw new Error("Orchestrator must be initialized before setting up iteration callbacks");
		}

		const branchModeManager = getBranchModeManager();

		getIterationCoordinator().setupIterationCallbacks({
			iterations: this.iterations,
			config: this.config,
			skipVerification: this.skipVerification,
			branchModeEnabled: branchModeManager.isEnabled(),
			branchModeConfig: branchModeManager.getConfig(),
		});
	}

	startSession(
		prd: Prd | null,
		totalIterations: number,
	): import("@/lib/services/session-manager/types.ts").StartSessionResult {
		return getSessionManager().startSession(prd, totalIterations);
	}

	resumeSession(
		pendingSession: Session,
		prd: Prd | null,
	): import("@/lib/services/session-manager/types.ts").ResumeSessionResult {
		return getSessionManager().resumeSession(pendingSession, prd);
	}

	handleFatalError(error: string, prd: Prd | null, currentSession: Session | null): Session | null {
		const result = getSessionManager().handleFatalError(error, prd, currentSession);

		return result.session;
	}

	cleanup(): void {
		this.initialized = false;

		getHandlerCoordinator().cleanup();
		getIterationCoordinator().clearState();
		getParallelExecutionManager().reset();
		getBranchModeManager().reset();

		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };

		useIterationStore.getState().clearCallbacks();

		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
