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
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return { output: output.trim(), success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return { output: errorMessage, success: false };
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

  function getRemoteUrl(cwd: string = process.cwd()): string | null {
    const remoteName = getRemoteName(cwd);

    if (!remoteName) {
      return null;
    }

    const result = execGitCommand(`git remote get-url ${remoteName}`, cwd);

    if (!result.success || result.output.length === 0) {
      return null;
    }

    return result.output;
  }

  function getWorkingDirectoryStatus(cwd: string = process.cwd()): WorkingDirectoryStatus {
    const statusResult = execGitCommand("git status --porcelain", cwd);

    if (!statusResult.success) {
      return {
        hasUncommittedChanges: false,
        hasUntrackedFiles: false,
        isClean: false,
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
      hasUncommittedChanges: modifiedFiles.length > 0,
      hasUntrackedFiles: untrackedFiles.length > 0,
      isClean: lines.length === 0,
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
        branchName,
        error: result.output,
        message: `Failed to create branch: ${branchName}`,
        status: "error",
      };
    }

    return {
      branchName,
      message: `Created branch: ${branchName}`,
      status: "success",
    };
  }

  function checkoutBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
    const result = execGitCommand(`git checkout "${branchName}"`, cwd);

    if (!result.success) {
      return {
        branchName,
        error: result.output,
        message: `Failed to checkout branch: ${branchName}`,
        status: "error",
      };
    }

    return {
      branchName,
      message: `Checked out branch: ${branchName}`,
      status: "success",
    };
  }

  function deleteBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
    const result = execGitCommand(`git branch -d "${branchName}"`, cwd);

    if (!result.success) {
      return {
        branchName,
        error: result.output,
        message: `Failed to delete branch: ${branchName}`,
        status: "error",
      };
    }

    return {
      branchName,
      message: `Deleted branch: ${branchName}`,
      status: "success",
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
        error: "The current directory is not a git repository",
        message: "Not a git repository",
        status: "error",
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
        branchName,
        error: createAndCheckoutResult.output,
        message: `Failed to create and checkout branch: ${branchName}`,
        status: "error",
      };
    }

    return {
      branchName,
      message: `Created and checked out branch: ${branchName}`,
      status: "success",
    };
  }

  function commitChanges(message: string, cwd: string = process.cwd()): BranchOperationResult {
    const stageResult = execGitCommand("git add -A", cwd);

    if (!stageResult.success) {
      return {
        error: stageResult.output,
        message: "Failed to stage changes",
        status: "error",
      };
    }

    const escapedMessage = message.replace(/"/g, String.raw`\"`);
    const commitResult = execGitCommand(`git commit -m "${escapedMessage}"`, cwd);

    if (!commitResult.success) {
      if (commitResult.output.includes("nothing to commit")) {
        return {
          message: "No changes to commit",
          status: "skipped",
        };
      }

      return {
        error: commitResult.output,
        message: "Failed to commit changes",
        status: "error",
      };
    }

    return {
      message: "Changes committed successfully",
      status: "success",
    };
  }

  function pushBranch(branchName: string, cwd: string = process.cwd()): BranchOperationResult {
    const remoteName = getRemoteName(cwd);

    if (!remoteName) {
      return {
        branchName,
        message: "No remote configured, skipping push",
        status: "skipped",
      };
    }

    const result = execGitCommand(`git push -u ${remoteName} "${branchName}"`, cwd);

    if (!result.success) {
      return {
        branchName,
        error: result.output,
        message: `Failed to push branch: ${branchName}`,
        status: "error",
      };
    }

    return {
      branchName,
      message: `Pushed branch to ${remoteName}: ${branchName}`,
      status: "success",
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
      baseBranch,
      currentBranch,
      hasRemote: hasRemoteConfig,
      remoteName,
    };
  }

  function stashChanges(cwd: string = process.cwd()): BranchOperationResult {
    const result = execGitCommand("git stash push -m 'ralph-auto-stash'", cwd);

    if (!result.success) {
      return {
        error: result.output,
        message: "Failed to stash changes",
        status: "error",
      };
    }

    if (result.output.includes("No local changes to save")) {
      return {
        message: "No changes to stash",
        status: "skipped",
      };
    }

    return {
      message: "Changes stashed successfully",
      status: "success",
    };
  }

  function popStash(cwd: string = process.cwd()): BranchOperationResult {
    const result = execGitCommand("git stash pop", cwd);

    if (!result.success) {
      if (result.output.includes("No stash entries found")) {
        return {
          message: "No stash to pop",
          status: "skipped",
        };
      }

      return {
        error: result.output,
        message: "Failed to pop stash",
        status: "error",
      };
    }

    return {
      message: "Stash popped successfully",
      status: "success",
    };
  }

  return {
    checkoutBranch,
    commitChanges,
    createAndCheckoutTaskBranch,
    createBranch,
    deleteBranch,
    generateBranchName,
    getBaseBranch,
    getBranchInfo,
    getCurrentBranch,
    getRemoteName,
    getRemoteUrl,
    getWorkingDirectoryStatus,
    hasRemote,
    isWorkingDirectoryClean,
    popStash,
    pushBranch,
    returnToBaseBranch,
    stashChanges,
  };
}
