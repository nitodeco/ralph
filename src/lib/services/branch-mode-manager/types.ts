import type { BranchModeConfig } from "../config/types.ts";
import type { Prd } from "../prd/types.ts";

export interface InitializeBranchModeResult {
	isValid: boolean;
	error?: string;
}

export interface CreateTaskBranchResult {
	success: boolean;
	error?: string;
}

export interface CompleteTaskBranchResult {
	success: boolean;
	error?: string;
	prUrl?: string;
}

export interface CreatePullRequestResult {
	success: boolean;
	prUrl?: string;
	error?: string;
}

export interface BranchModeManager {
	isEnabled(): boolean;
	getConfig(): BranchModeConfig | null;
	getBaseBranch(): string | null;
	getCurrentTaskBranch(): string | null;

	setEnabled(enabled: boolean): void;
	setConfig(config: BranchModeConfig | null): void;

	initialize(): InitializeBranchModeResult;
	createTaskBranch(taskTitle: string, taskIndex: number): CreateTaskBranchResult;
	completeTaskBranch(prd: Prd | null): Promise<CompleteTaskBranchResult>;
	createPullRequestForBranch(branchName: string, prd: Prd | null): Promise<CreatePullRequestResult>;

	reset(): void;
}
