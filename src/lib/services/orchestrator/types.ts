import type { RalphConfig } from "@/types.ts";
import type { BranchModeConfig } from "../config/types.ts";
import type { ParallelExecutionConfig } from "../parallel-execution-manager/types.ts";
import type { Prd } from "../prd/types.ts";
import type { Session } from "../session/types.ts";
import type { ResumeSessionResult, StartSessionResult } from "../session-manager/types.ts";

export interface OrchestratorConfig {
	config: RalphConfig;
	iterations: number;
	maxRuntimeMs?: number;
	skipVerification?: boolean;
	parallelExecution?: ParallelExecutionConfig;
}

export interface OrchestratorCallbacks {
	onPrdUpdate: (prd: Prd) => void;
	onRestartIteration: () => void;
	onVerificationStateChange: (
		isVerifying: boolean,
		result: import("@/types.ts").VerificationResult | null,
	) => void;
	onIterationComplete: (allTasksDone: boolean, hasPendingTasks: boolean) => void;
	onFatalError: (error: string, prd: Prd | null, currentSession: Session | null) => void;
	onAppStateChange: (state: "error") => void;
	setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => void;
}

export interface Orchestrator {
	initialize(options: OrchestratorConfig, callbacks: OrchestratorCallbacks): void;
	setupIterationCallbacks(): void;
	getConfig(): RalphConfig | null;
	getIsVerifying(): boolean;

	isBranchModeEnabled(): boolean;
	getBranchModeConfig(): BranchModeConfig | null;
	getCurrentTaskBranch(): string | null;
	getBaseBranch(): string | null;
	initializeBranchMode(): { isValid: boolean; error?: string };
	createTaskBranch(taskTitle: string, taskIndex: number): { success: boolean; error?: string };
	completeTaskBranch(
		prd: Prd | null,
	): Promise<{ success: boolean; error?: string; prUrl?: string }>;
	createPullRequestForBranch(
		branchName: string,
		prd: Prd | null,
	): Promise<{ success: boolean; prUrl?: string; error?: string }>;

	isParallelModeEnabled(): boolean;
	getParallelConfig(): ParallelExecutionConfig;
	getCurrentParallelGroup():
		| import("../parallel-execution-manager/types.ts").ParallelGroupState
		| null;
	getParallelExecutionGroups(): import("../prd/types.ts").PrdTask[][];
	initializeParallelExecution(prd: Prd): { isValid: boolean; error?: string };
	startNextParallelGroup(): {
		started: boolean;
		groupIndex: number;
		tasks: import("../prd/types.ts").PrdTask[];
	};
	recordParallelTaskStart(task: import("../prd/types.ts").PrdTask, processId: string): void;
	recordParallelTaskComplete(
		taskId: string,
		taskTitle: string,
		wasSuccessful: boolean,
		error?: string,
	): { groupComplete: boolean; allSucceeded: boolean };
	getReadyTasksForParallelExecution(): import("../prd/types.ts").PrdTask[];
	hasMoreParallelGroups(): boolean;
	getParallelExecutionSummary(): import("../parallel-execution-manager/types.ts").ParallelExecutionSummary;
	disableParallelExecution(): void;

	startSession(prd: Prd | null, totalIterations: number): StartSessionResult;
	resumeSession(pendingSession: Session, prd: Prd | null): ResumeSessionResult;
	handleFatalError(error: string, prd: Prd | null, currentSession: Session | null): Session | null;

	cleanup(): void;
}
