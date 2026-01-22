import type { BranchModeConfig } from "../config/types.ts";

export type BranchOperationStatus = "success" | "error" | "skipped";

export interface BranchOperationResult {
	status: BranchOperationStatus;
	message: string;
	branchName?: string;
	error?: string;
}

export interface WorkingDirectoryStatus {
	isClean: boolean;
	hasUncommittedChanges: boolean;
	hasUntrackedFiles: boolean;
	modifiedFiles: string[];
	untrackedFiles: string[];
}

export interface BranchInfo {
	currentBranch: string;
	baseBranch: string;
	hasRemote: boolean;
	remoteName: string | null;
}

export interface GitBranchService {
	getCurrentBranch(cwd?: string): string | null;
	getBaseBranch(cwd?: string): string;
	hasRemote(cwd?: string): boolean;
	getRemoteName(cwd?: string): string | null;
	getRemoteUrl(cwd?: string): string | null;

	getWorkingDirectoryStatus(cwd?: string): WorkingDirectoryStatus;
	isWorkingDirectoryClean(cwd?: string): boolean;

	createBranch(branchName: string, cwd?: string): BranchOperationResult;
	checkoutBranch(branchName: string, cwd?: string): BranchOperationResult;
	deleteBranch(branchName: string, cwd?: string): BranchOperationResult;

	createAndCheckoutTaskBranch(
		taskTitle: string,
		taskIndex: number,
		config: BranchModeConfig,
		cwd?: string,
	): BranchOperationResult;

	commitChanges(message: string, cwd?: string): BranchOperationResult;
	pushBranch(branchName: string, cwd?: string): BranchOperationResult;
	returnToBaseBranch(baseBranch: string, cwd?: string): BranchOperationResult;

	generateBranchName(taskTitle: string, taskIndex: number, prefix?: string): string;
	getBranchInfo(cwd?: string): BranchInfo;

	stashChanges(cwd?: string): BranchOperationResult;
	popStash(cwd?: string): BranchOperationResult;
}
