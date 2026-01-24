import { getErrorMessage } from "@/lib/errors.ts";
import type { AgentCompleteEvent } from "@/lib/events.ts";
import { eventBus } from "@/lib/events.ts";
import { DecompositionHandler, VerificationHandler } from "@/lib/handlers/index.ts";
import { getLogger } from "@/lib/logger.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import type { BranchModeConfig } from "@/lib/services/config/types.ts";
import {
	getBranchModeManager,
	getConfigService,
	getIterationCoordinator,
	getParallelExecutionManager,
	getPrdService,
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
	private unsubscribers: (() => void)[] = [];
	private initialized = false;
	private decompositionHandler: DecompositionHandler | null = null;
	private verificationHandler: VerificationHandler | null = null;

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

		this.decompositionHandler = new DecompositionHandler({
			config: options.config,
			onPrdUpdate: (prd) => {
				useAppStore.setState({ prd });
			},
			onRestartIteration: () => {
				useIterationStore.getState().restartCurrentIteration();
			},
		});
		this.verificationHandler = new VerificationHandler({
			onStateChange: (isVerifying, result) => {
				useAppStore.setState({ isVerifying, lastVerificationResult: result });
			},
		});
		this.setupSubscriptions();

		const iterationStore = useIterationStore.getState();

		iterationStore.setMaxRuntimeMs(this.maxRuntimeMs);
	}

	getIsVerifying(): boolean {
		return this.verificationHandler?.getIsRunning() ?? false;
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

	private setupSubscriptions(): void {
		const loadedConfig = getConfigService().get();
		const logger = getLogger({ logFilePath: loadedConfig.logFilePath });
		const iterationCoordinator = getIterationCoordinator();

		this.unsubscribers.push(
			eventBus.on("agent:complete", (event) => {
				try {
					this.handleAgentComplete(event).catch((error) => {
						logger.error("Error in handleAgentComplete", { error: getErrorMessage(error) });

						const iterationStore = useIterationStore.getState();

						iterationStore.markIterationComplete(false, true);
					});
				} catch (error) {
					logger.error("Sync error in agent:complete handler", { error: getErrorMessage(error) });

					const iterationStore = useIterationStore.getState();

					iterationStore.markIterationComplete(false, true);
				}
			}),
		);

		this.unsubscribers.push(
			eventBus.on("agent:error", (event) => {
				try {
					if (event.retryContexts) {
						iterationCoordinator.setLastRetryContexts(event.retryContexts);
					}

					if (event.isFatal) {
						const appState = useAppStore.getState();

						this.handleFatalError(event.error, appState.prd, appState.currentSession);
						useAppStore.setState({ appState: "error" });
					}
				} catch (error) {
					logger.error("Error in agent:error handler", { error: getErrorMessage(error) });
					useAppStore.setState({ appState: "error" });
				}
			}),
		);
	}

	private async handleAgentComplete(event: AgentCompleteEvent): Promise<void> {
		const iterationCoordinator = getIterationCoordinator();

		if (event.retryContexts) {
			iterationCoordinator.setLastRetryContexts(event.retryContexts);
		}

		const prdService = getPrdService();
		const currentPrd = prdService.reload();

		if (event.hasDecompositionRequest && event.decompositionRequest && this.decompositionHandler) {
			const handled = this.decompositionHandler.handle(event.decompositionRequest, currentPrd);

			if (handled) {
				iterationCoordinator.setLastDecomposition(event.decompositionRequest);

				return;
			}
		}

		const allTasksActuallyDone = currentPrd
			? currentPrd.tasks.length > 0 && currentPrd.tasks.every((task) => task.done)
			: false;

		const hasPendingTasks = currentPrd ? currentPrd.tasks.some((task) => !task.done) : false;

		const verificationConfig = this.config?.verification;

		if (
			verificationConfig?.enabled &&
			!this.skipVerification &&
			!allTasksActuallyDone &&
			this.verificationHandler
		) {
			try {
				const verificationResult = await this.verificationHandler.run(verificationConfig);

				if (!verificationResult.passed) {
					const iterationStore = useIterationStore.getState();
					const loadedConfig = getConfigService().get();
					const currentPrd = prdService.reload();

					sendNotifications(
						loadedConfig.notifications,
						"verification_failed",
						currentPrd?.project,
						{
							failedChecks: verificationResult.failedChecks,
							iteration: iterationStore.current,
						},
					);

					iterationStore.markIterationComplete(false, hasPendingTasks);

					return;
				}
			} catch (verificationError) {
				const loadedConfig = getConfigService().get();
				const logger = getLogger({ logFilePath: loadedConfig.logFilePath });

				logger.error("Verification handler threw an error, continuing without verification", {
					error: getErrorMessage(verificationError),
				});
				this.verificationHandler?.reset();
			}
		} else {
			this.verificationHandler?.reset();
		}

		const iterationStore = useIterationStore.getState();

		iterationStore.markIterationComplete(allTasksActuallyDone, hasPendingTasks);
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
		for (const unsubscribe of this.unsubscribers) {
			unsubscribe();
		}

		this.unsubscribers = [];
		this.initialized = false;
		this.decompositionHandler?.reset();
		this.verificationHandler?.reset();
		this.decompositionHandler = null;
		this.verificationHandler = null;

		getIterationCoordinator().clearState();
		getParallelExecutionManager().reset();
		getBranchModeManager().reset();

		this.parallelConfig = { enabled: false, maxConcurrentTasks: 1 };

		useIterationStore.getState().clearCallbacks();

		eventBus.removeAllListeners();
	}
}

export const orchestrator = new SessionOrchestrator();
