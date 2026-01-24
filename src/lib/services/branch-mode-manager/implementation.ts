import { getErrorMessage } from "@/lib/errors.ts";
import { getLogger } from "@/lib/logger.ts";
import { appendProgress } from "@/lib/progress.ts";
import type { RalphConfig } from "@/types.ts";
import type { BranchModeConfig } from "../config/types.ts";
import { getConfigService, getGitBranchService, getGitProviderService } from "../container.ts";
import type { Prd } from "../prd/types.ts";
import type {
	BranchModeManager,
	CompleteTaskBranchResult,
	CreatePullRequestResult,
	CreateTaskBranchResult,
	InitializeBranchModeResult,
} from "./types.ts";

export function createBranchModeManager(): BranchModeManager {
	let branchModeEnabled = false;
	let branchModeConfig: BranchModeConfig | null = null;
	let baseBranch: string | null = null;
	let currentTaskBranch: string | null = null;
	let cachedConfig: RalphConfig | null = null;

	function isEnabled(): boolean {
		return branchModeEnabled;
	}

	function getConfig(): BranchModeConfig | null {
		return branchModeConfig;
	}

	function getBaseBranch(): string | null {
		return baseBranch;
	}

	function getCurrentTaskBranch(): string | null {
		return currentTaskBranch;
	}

	function setEnabled(enabled: boolean): void {
		branchModeEnabled = enabled;
	}

	function setConfig(config: BranchModeConfig | null): void {
		branchModeConfig = config;
	}

	function setRalphConfig(config: RalphConfig): void {
		cachedConfig = config;
	}

	function initialize(): InitializeBranchModeResult {
		if (!branchModeEnabled) {
			return { isValid: true };
		}

		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const gitBranchService = getGitBranchService();
		const workingStatus = gitBranchService.getWorkingDirectoryStatus();

		if (!workingStatus.isClean) {
			const errorMessage =
				"Working directory has uncommitted changes. Please commit or stash changes before using branch mode.";

			logger.warn("Branch mode initialization failed: dirty working directory", {
				modifiedFiles: workingStatus.modifiedFiles,
				untrackedFiles: workingStatus.untrackedFiles,
			});

			return { isValid: false, error: errorMessage };
		}

		const branchInfo = gitBranchService.getBranchInfo();

		baseBranch = branchInfo.currentBranch;

		logger.info("Branch mode initialized", {
			baseBranch: baseBranch,
			hasRemote: branchInfo.hasRemote,
		});

		appendProgress(`=== Branch Mode Enabled ===\nBase branch: ${baseBranch}\n`);

		return { isValid: true };
	}

	function createTaskBranch(taskTitle: string, taskIndex: number): CreateTaskBranchResult {
		if (!branchModeEnabled || !branchModeConfig) {
			return { success: true };
		}

		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const gitBranchService = getGitBranchService();
		const result = gitBranchService.createAndCheckoutTaskBranch(
			taskTitle,
			taskIndex,
			branchModeConfig,
		);

		if (result.status === "error") {
			logger.error("Failed to create task branch", {
				taskTitle,
				taskIndex,
				error: result.error,
			});

			return { success: false, error: result.error };
		}

		currentTaskBranch = result.branchName ?? null;

		logger.info("Created and checked out task branch", {
			taskTitle,
			taskIndex,
			branchName: currentTaskBranch,
		});

		appendProgress(`Switched to branch: ${currentTaskBranch}\n`);

		return { success: true };
	}

	async function completeTaskBranch(prd: Prd | null): Promise<CompleteTaskBranchResult> {
		if (!branchModeEnabled || !branchModeConfig || !currentTaskBranch) {
			return { success: true };
		}

		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const gitBranchService = getGitBranchService();
		const branchName = currentTaskBranch;
		const shouldPush = branchModeConfig.pushAfterCommit ?? true;
		const shouldReturn = branchModeConfig.returnToBaseBranch ?? true;
		let wasPushed = false;

		if (shouldPush) {
			const pushResult = gitBranchService.pushBranch(branchName);

			if (pushResult.status === "error") {
				logger.warn("Failed to push branch", {
					branchName,
					error: pushResult.error,
				});
				appendProgress(`Warning: Failed to push branch ${branchName}: ${pushResult.error}\n`);
			} else if (pushResult.status === "success") {
				logger.info("Pushed branch", { branchName });
				appendProgress(`Pushed branch: ${branchName}\n`);
				wasPushed = true;
			} else {
				appendProgress(`Skipped push: ${pushResult.message}\n`);
			}
		}

		let prUrl: string | undefined;

		if (wasPushed) {
			const prResult = await createPullRequestForBranch(branchName, prd);

			if (prResult.prUrl) {
				prUrl = prResult.prUrl;
			}
		}

		if (shouldReturn && baseBranch) {
			const returnResult = gitBranchService.returnToBaseBranch(baseBranch);

			if (returnResult.status === "error") {
				logger.error("Failed to return to base branch", {
					baseBranch: baseBranch,
					error: returnResult.error,
				});

				return { success: false, error: returnResult.error };
			}

			logger.info("Returned to base branch", { baseBranch: baseBranch });
			appendProgress(`Returned to base branch: ${baseBranch}\n`);
		}

		currentTaskBranch = null;

		return { success: true, prUrl };
	}

	async function createPullRequestForBranch(
		branchName: string,
		prd: Prd | null,
	): Promise<CreatePullRequestResult> {
		if (!branchModeEnabled || !baseBranch) {
			return { success: false, error: "Branch mode not enabled or no base branch" };
		}

		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const gitProviderConfig = config.gitProvider;

		if (!gitProviderConfig?.autoCreatePr) {
			logger.info("Auto PR creation disabled, skipping", { branchName });

			return { success: true };
		}

		const gitBranchService = getGitBranchService();
		const remoteUrl = gitBranchService.getRemoteUrl();

		if (!remoteUrl) {
			logger.warn("No remote URL found, cannot create PR", { branchName });

			return { success: false, error: "No remote URL configured" };
		}

		const gitProviderService = getGitProviderService();
		const remoteInfo = gitProviderService.detectProvider(remoteUrl);

		if (remoteInfo.provider === "none") {
			logger.warn("Unknown git provider, cannot create PR", { remoteUrl });

			return { success: false, error: `Unknown git provider for remote: ${remoteUrl}` };
		}

		const provider = gitProviderService.getProvider(remoteInfo);

		if (!provider) {
			logger.warn("Git provider not configured", {
				provider: remoteInfo.provider,
				branchName,
			});

			return { success: false, error: `${remoteInfo.provider} provider not configured` };
		}

		if (!provider.isConfigured) {
			logger.warn("Git provider token not configured", {
				provider: remoteInfo.provider,
				branchName,
			});

			return {
				success: false,
				error: `${remoteInfo.provider} token not configured`,
			};
		}

		const prTitle = prd?.project
			? `[Ralph] ${prd.project}: ${branchName}`
			: `[Ralph] ${branchName}`;

		const prBody = generatePrBody(prd, branchName);

		try {
			const result = await provider.createPullRequest({
				title: prTitle,
				body: prBody,
				head: branchName,
				base: baseBranch,
				isDraft: gitProviderConfig.prDraft ?? false,
				labels: gitProviderConfig.prLabels,
				reviewers: gitProviderConfig.prReviewers,
			});

			if (!result.success || !result.data) {
				logger.error("Failed to create PR", {
					branchName,
					error: result.error,
				});

				return { success: false, error: result.error };
			}

			logger.info("Created pull request", {
				prNumber: result.data.number,
				prUrl: result.data.url,
				branchName,
				baseBranch: baseBranch,
			});

			appendProgress(
				`\n=== Pull Request Created ===\nPR #${result.data.number}: ${result.data.url}\n`,
			);

			return { success: true, prUrl: result.data.url };
		} catch (error) {
			const errorMessage = getErrorMessage(error);

			logger.error("Failed to create PR", {
				branchName,
				error: errorMessage,
			});

			return { success: false, error: errorMessage };
		}
	}

	function generatePrBody(prd: Prd | null, branchName: string): string {
		const lines: string[] = ["## Summary", ""];

		if (prd?.project) {
			lines.push(`Automated PR created by Ralph for project: **${prd.project}**`);
		} else {
			lines.push("Automated PR created by Ralph.");
		}

		lines.push("");
		lines.push(`Branch: \`${branchName}\``);

		if (prd?.tasks && prd.tasks.length > 0) {
			const completedTasks = prd.tasks.filter((task) => task.done);
			const totalTasks = prd.tasks.length;

			lines.push("");
			lines.push("## Tasks Completed");
			lines.push("");
			lines.push(`${completedTasks.length} / ${totalTasks} tasks completed.`);
			lines.push("");

			for (const task of completedTasks) {
				lines.push(`- [x] ${task.title}`);
			}
		}

		lines.push("");
		lines.push("---");
		lines.push("*This PR was automatically created by [Ralph](https://github.com/your-org/ralph)*");

		return lines.join("\n");
	}

	function reset(): void {
		branchModeEnabled = false;
		branchModeConfig = null;
		baseBranch = null;
		currentTaskBranch = null;
		cachedConfig = null;
	}

	return {
		isEnabled,
		getConfig,
		getBaseBranch,
		getCurrentTaskBranch,
		setEnabled,
		setConfig,
		setRalphConfig,
		initialize,
		createTaskBranch,
		completeTaskBranch,
		createPullRequestForBranch,
		reset,
	};
}
