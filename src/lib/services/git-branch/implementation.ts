import { execSync } from "node:child_process";
import { isGitRepository } from "@/lib/paths.ts";
import type { BranchModeConfig } from "../config/types.ts";
import type {
	BranchInfo,
	BranchOperationResult,
	GitBranchService,
	WorkingDirectoryStatus,
} from "./types.ts";

function execGitCommand(command: string, cwd: string): { success: boolean; output: string } {
	try {
		const output = execSync(command, {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		return { success: true, output: output.trim() };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return { success: false, output: errorMessage };
	}
}

function sanitizeBranchName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 50);
}

export function createGitBranchService(): GitBranchService {
	function getCurrentBranch(cwd: string = process.cwd()): string | null {
		if (!isGitRepository(cwd)) {
			return null;
		}

		const result = execGitCommand("git branch --show-current", cwd);

		if (!result.success || result.output.length === 0) {
			const headResult = execGitCommand("git rev-parse --abbrev-ref HEAD", cwd);

			return headResult.success ? headResult.output : null;
		}

		return result.output;
	}

	function getBaseBranch(cwd: string = process.cwd()): string {
		const mainResult = execGitCommand("git show-ref --verify --quiet refs/heads/main", cwd);

		if (mainResult.success) {
			return "main";
		}

		const masterResult = execGitCommand("git show-ref --verify --quiet refs/heads/master", cwd);

		if (masterResult.success) {
			return "master";
		}

		return "main";
	}

	function hasRemote(cwd: string = process.cwd()): boolean {
		const result = execGitCommand("git remote", cwd);

		return result.success && result.output.length > 0;
	}

	function getRemoteName(cwd: string = process.cwd()): string | null {
		const result = execGitCommand("git remote", cwd);

		if (!result.success || result.output.length === 0) {
			return null;
		}

		const [firstRemote] = result.output.split("\n");

		return firstRemote ?? null;
	}

	function getWorkingDirectoryStatus(cwd: string = process.cwd()): WorkingDirectoryStatus {
		const statusResult = execGitCommand("git status --porcelain", cwd);

		if (!statusResult.success) {
			return {
				isClean: false,
				hasUncommittedChanges: false,
				hasUntrackedFiles: false,
				modifiedFiles: [],
				untrackedFiles: [],
			};
		}

		const lines = statusResult.output.split("\n").filter((line) => line.length > 0);
		const modifiedFiles: string[] = [];
		const untrackedFiles: string[] = [];

		for (const line of lines) {
			const statusCode = line.slice(0, 2);
			const fileName = line.slice(3);

			if (statusCode === "??") {
				untrackedFiles.push(fileName);
			} else {
				modifiedFiles.push(fileName);
			}
		}

		return {
			isClean: lines.length === 0,
			hasUncommittedChanges: modifiedFiles.length > 0,
			hasUntrackedFiles: untrackedFiles.length > 0,
			modifiedFiles,
			untrackedFiles,
		};
	}

	function isWorkingDirectoryClean(cwd: string = process.cwd()): boolean {
		const status = getWorkingDirectoryStatus(cwd);

		return status.isClean;
	}

	function createBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
		const result = execGitCommand(`git branch "${branchName}"`, cwd);

		if (!result.success) {
			return {
				status: "error",
				message: `Failed to create branch: ${branchName}`,
				branchName,
				error: result.output,
			};
		}

		return {
			status: "success",
			message: `Created branch: ${branchName}`,
			branchName,
		};
	}

	function checkoutBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
		const result = execGitCommand(`git checkout "${branchName}"`, cwd);

		if (!result.success) {
			return {
				status: "error",
				message: `Failed to checkout branch: ${branchName}`,
				branchName,
				error: result.output,
			};
		}

		return {
			status: "success",
			message: `Checked out branch: ${branchName}`,
			branchName,
		};
	}

	function deleteBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
		const result = execGitCommand(`git branch -d "${branchName}"`, cwd);

		if (!result.success) {
			return {
				status: "error",
				message: `Failed to delete branch: ${branchName}`,
				branchName,
				error: result.output,
			};
		}

		return {
			status: "success",
			message: `Deleted branch: ${branchName}`,
			branchName,
		};
	}

	function generateBranchName(taskTitle: string, taskIndex: number, prefix = "ralph"): string {
		const sanitizedTitle = sanitizeBranchName(taskTitle);
		const taskNumber = taskIndex + 1;

		return `${prefix}/task-${taskNumber}-${sanitizedTitle}`;
	}

	function createAndCheckoutTaskBranch(
		taskTitle: string,
		taskIndex: number,
		config: BranchModeConfig,
		cwd: string = process.cwd(),
	): BranchOperationResult {
		if (!isGitRepository(cwd)) {
			return {
				status: "error",
				message: "Not a git repository",
				error: "The current directory is not a git repository",
			};
		}

		const branchName = generateBranchName(taskTitle, taskIndex, config.branchPrefix ?? "ralph");

		const existingBranchResult = execGitCommand(
			`git show-ref --verify --quiet refs/heads/${branchName}`,
			cwd,
		);

		if (existingBranchResult.success) {
			return checkoutBranch(branchName, cwd);
		}

		const createAndCheckoutResult = execGitCommand(`git checkout -b "${branchName}"`, cwd);

		if (!createAndCheckoutResult.success) {
			return {
				status: "error",
				message: `Failed to create and checkout branch: ${branchName}`,
				branchName,
				error: createAndCheckoutResult.output,
			};
		}

		return {
			status: "success",
			message: `Created and checked out branch: ${branchName}`,
			branchName,
		};
	}

	function commitChanges(message: string, cwd: string = process.cwd()): BranchOperationResult {
		const stageResult = execGitCommand("git add -A", cwd);

		if (!stageResult.success) {
			return {
				status: "error",
				message: "Failed to stage changes",
				error: stageResult.output,
			};
		}

		const escapedMessage = message.replace(/"/g, '\\"');
		const commitResult = execGitCommand(`git commit -m "${escapedMessage}"`, cwd);

		if (!commitResult.success) {
			if (commitResult.output.includes("nothing to commit")) {
				return {
					status: "skipped",
					message: "No changes to commit",
				};
			}

			return {
				status: "error",
				message: "Failed to commit changes",
				error: commitResult.output,
			};
		}

		return {
			status: "success",
			message: "Changes committed successfully",
		};
	}

	function pushBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
		const remoteName = getRemoteName(cwd);

		if (!remoteName) {
			return {
				status: "skipped",
				message: "No remote configured, skipping push",
				branchName,
			};
		}

		const result = execGitCommand(`git push -u ${remoteName} "${branchName}"`, cwd);

		if (!result.success) {
			return {
				status: "error",
				message: `Failed to push branch: ${branchName}`,
				branchName,
				error: result.output,
			};
		}

		return {
			status: "success",
			message: `Pushed branch to ${remoteName}: ${branchName}`,
			branchName,
		};
	}

	function returnToBaseBranch(
		baseBranch: string,
		cwd: string = process.cwd(),
	): BranchOperationResult {
		return checkoutBranch(baseBranch, cwd);
	}

	function getBranchInfo(cwd: string = process.cwd()): BranchInfo {
		const currentBranch = getCurrentBranch(cwd) ?? "unknown";
		const baseBranch = getBaseBranch(cwd);
		const hasRemoteConfig = hasRemote(cwd);
		const remoteName = getRemoteName(cwd);

		return {
			currentBranch,
			baseBranch,
			hasRemote: hasRemoteConfig,
			remoteName,
		};
	}

	function stashChanges(cwd: string = process.cwd()): BranchOperationResult {
		const result = execGitCommand("git stash push -m 'ralph-auto-stash'", cwd);

		if (!result.success) {
			return {
				status: "error",
				message: "Failed to stash changes",
				error: result.output,
			};
		}

		if (result.output.includes("No local changes to save")) {
			return {
				status: "skipped",
				message: "No changes to stash",
			};
		}

		return {
			status: "success",
			message: "Changes stashed successfully",
		};
	}

	function popStash(cwd: string = process.cwd()): BranchOperationResult {
		const result = execGitCommand("git stash pop", cwd);

		if (!result.success) {
			if (result.output.includes("No stash entries found")) {
				return {
					status: "skipped",
					message: "No stash to pop",
				};
			}

			return {
				status: "error",
				message: "Failed to pop stash",
				error: result.output,
			};
		}

		return {
			status: "success",
			message: "Stash popped successfully",
		};
	}

	return {
		getCurrentBranch,
		getBaseBranch,
		hasRemote,
		getRemoteName,
		getWorkingDirectoryStatus,
		isWorkingDirectoryClean,
		createBranch,
		checkoutBranch,
		deleteBranch,
		createAndCheckoutTaskBranch,
		commitChanges,
		pushBranch,
		returnToBaseBranch,
		generateBranchName,
		getBranchInfo,
		stashChanges,
		popStash,
	};
}
