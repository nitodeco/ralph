import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createBranchModeManager } from "@/lib/services/branch-mode-manager/implementation.ts";
import type { BranchModeConfig } from "@/lib/services/config/types.ts";
import type { Prd } from "@/lib/services/prd/types.ts";

function createMockPrd(overrides: Partial<Prd> = {}): Prd {
	return {
		project: "Test Project",
		tasks: [
			{ id: "task-1", title: "Task 1", description: "First task", steps: [], done: false },
			{ id: "task-2", title: "Task 2", description: "Second task", steps: [], done: true },
		],
		...overrides,
	};
}

describe("BranchModeManager", () => {
	let lastCreatedBranch: string | null;
	let lastPushedBranch: string | null;
	let currentBranch: string;
	let isWorkingDirClean: boolean;

	beforeEach(() => {
		lastCreatedBranch = null;
		lastPushedBranch = null;
		currentBranch = "main";
		isWorkingDirClean = true;

		bootstrapTestServices({
			gitBranch: {
				getCurrentBranch: () => currentBranch,
				getBaseBranch: () => "main",
				hasRemote: () => true,
				getRemoteName: () => "origin",
				getRemoteUrl: () => "git@github.com:test-org/test-repo.git",
				getWorkingDirectoryStatus: () => ({
					isClean: isWorkingDirClean,
					hasUncommittedChanges: !isWorkingDirClean,
					hasUntrackedFiles: false,
					modifiedFiles: isWorkingDirClean ? [] : ["file.txt"],
					untrackedFiles: [],
				}),
				isWorkingDirectoryClean: () => isWorkingDirClean,
				createBranch: (branchName) => {
					lastCreatedBranch = branchName;

					return {
						status: "success",
						message: `Created branch: ${branchName}`,
						branchName,
					};
				},
				checkoutBranch: (branchName) => {
					currentBranch = branchName;

					return {
						status: "success",
						message: `Checked out branch: ${branchName}`,
						branchName,
					};
				},
				deleteBranch: (branchName) => ({
					status: "success",
					message: `Deleted branch: ${branchName}`,
					branchName,
				}),
				createAndCheckoutTaskBranch: (taskTitle, taskIndex) => {
					const branchName = `ralph/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`;

					lastCreatedBranch = branchName;
					currentBranch = branchName;

					return {
						status: "success",
						message: `Created and checked out branch: ${branchName}`,
						branchName,
					};
				},
				commitChanges: () => ({
					status: "success",
					message: "Changes committed successfully",
				}),
				pushBranch: (branchName) => {
					lastPushedBranch = branchName;

					return {
						status: "success",
						message: `Pushed branch: ${branchName}`,
						branchName,
					};
				},
				returnToBaseBranch: (baseBranch) => {
					currentBranch = baseBranch;

					return {
						status: "success",
						message: `Returned to branch: ${baseBranch}`,
						branchName: baseBranch,
					};
				},
				generateBranchName: (taskTitle, taskIndex, prefix = "ralph") =>
					`${prefix}/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`,
				getBranchInfo: () => ({
					currentBranch,
					baseBranch: "main",
					hasRemote: true,
					remoteName: "origin",
				}),
				stashChanges: () => ({
					status: "success",
					message: "Changes stashed successfully",
				}),
				popStash: () => ({
					status: "success",
					message: "Stash popped successfully",
				}),
			},
			gitProvider: {
				detectProvider: () => ({
					provider: "github",
					owner: "test-owner",
					repo: "test-repo",
					hostname: "github.com",
				}),
				getProvider: () => null,
				getProviderForRemote: () => null,
				isProviderConfigured: () => false,
				getSupportedProviders: () => [],
			},
		});
	});

	afterEach(() => {
		teardownTestServices();
	});

	describe("initial state", () => {
		test("isEnabled returns false by default", () => {
			const branchModeManager = createBranchModeManager();

			expect(branchModeManager.isEnabled()).toBe(false);
		});

		test("getConfig returns null by default", () => {
			const branchModeManager = createBranchModeManager();

			expect(branchModeManager.getConfig()).toBeNull();
		});

		test("getBaseBranch returns null by default", () => {
			const branchModeManager = createBranchModeManager();

			expect(branchModeManager.getBaseBranch()).toBeNull();
		});

		test("getCurrentTaskBranch returns null by default", () => {
			const branchModeManager = createBranchModeManager();

			expect(branchModeManager.getCurrentTaskBranch()).toBeNull();
		});
	});

	describe("setEnabled", () => {
		test("enables branch mode", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);

			expect(branchModeManager.isEnabled()).toBe(true);
		});

		test("disables branch mode", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setEnabled(false);

			expect(branchModeManager.isEnabled()).toBe(false);
		});
	});

	describe("setConfig", () => {
		test("stores branch mode config", () => {
			const branchModeManager = createBranchModeManager();

			const config: BranchModeConfig = {
				enabled: true,
				branchPrefix: "feature",
				pushAfterCommit: true,
				returnToBaseBranch: true,
			};

			branchModeManager.setConfig(config);

			expect(branchModeManager.getConfig()).toEqual(config);
		});

		test("allows setting config to null", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setConfig({
				enabled: true,
				branchPrefix: "feature",
			});

			branchModeManager.setConfig(null);

			expect(branchModeManager.getConfig()).toBeNull();
		});
	});

	describe("initialize", () => {
		test("returns valid when branch mode is disabled", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(false);

			const result = branchModeManager.initialize();

			expect(result.isValid).toBe(true);
		});

		test("returns valid when working directory is clean", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			isWorkingDirClean = true;

			const result = branchModeManager.initialize();

			expect(result.isValid).toBe(true);
			expect(branchModeManager.getBaseBranch()).toBe("main");
		});

		test("returns invalid when working directory has uncommitted changes", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			isWorkingDirClean = false;

			const result = branchModeManager.initialize();

			expect(result.isValid).toBe(false);
			expect(result.error).toContain("uncommitted changes");
		});
	});

	describe("createTaskBranch", () => {
		test("returns success when branch mode is disabled", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(false);

			const result = branchModeManager.createTaskBranch("Test Task", 0);

			expect(result.success).toBe(true);
			expect(lastCreatedBranch).toBeNull();
		});

		test("returns success when config is null", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig(null);

			const result = branchModeManager.createTaskBranch("Test Task", 0);

			expect(result.success).toBe(true);
		});

		test("creates and checks out task branch when enabled", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({
				enabled: true,
				branchPrefix: "ralph",
			});

			const result = branchModeManager.createTaskBranch("Add feature", 0);

			expect(result.success).toBe(true);
			expect(lastCreatedBranch).toContain("ralph/task-1");
			expect(branchModeManager.getCurrentTaskBranch()).toBe(lastCreatedBranch);
		});
	});

	describe("completeTaskBranch", () => {
		test("returns success when branch mode is disabled", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(false);

			const result = await branchModeManager.completeTaskBranch(createMockPrd());

			expect(result.success).toBe(true);
		});

		test("returns success when no current task branch", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({
				enabled: true,
			});

			const result = await branchModeManager.completeTaskBranch(createMockPrd());

			expect(result.success).toBe(true);
		});

		test("pushes branch and returns to base when configured", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({
				enabled: true,
				pushAfterCommit: true,
				returnToBaseBranch: true,
			});

			branchModeManager.initialize();
			branchModeManager.createTaskBranch("Test Task", 0);

			const result = await branchModeManager.completeTaskBranch(createMockPrd());

			expect(result.success).toBe(true);
			expect(lastPushedBranch).not.toBeNull();
			expect(currentBranch).toBe("main");
			expect(branchModeManager.getCurrentTaskBranch()).toBeNull();
		});

		test("skips push when pushAfterCommit is false", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({
				enabled: true,
				pushAfterCommit: false,
				returnToBaseBranch: true,
			});

			branchModeManager.initialize();
			branchModeManager.createTaskBranch("Test Task", 0);

			await branchModeManager.completeTaskBranch(createMockPrd());

			expect(lastPushedBranch).toBeNull();
		});
	});

	describe("createPullRequestForBranch", () => {
		test("returns error when branch mode is disabled", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(false);

			const result = await branchModeManager.createPullRequestForBranch(
				"feature-branch",
				createMockPrd(),
			);

			expect(result.success).toBe(false);
			expect(result.error).toContain("not enabled");
		});

		test("returns error when no base branch", async () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);

			const result = await branchModeManager.createPullRequestForBranch(
				"feature-branch",
				createMockPrd(),
			);

			expect(result.success).toBe(false);
		});
	});

	describe("reset", () => {
		test("resets all state", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({
				enabled: true,
				branchPrefix: "feature",
			});
			branchModeManager.setRalphConfig({ agent: "cursor" });
			branchModeManager.initialize();
			branchModeManager.createTaskBranch("Test Task", 0);

			branchModeManager.reset();

			expect(branchModeManager.isEnabled()).toBe(false);
			expect(branchModeManager.getConfig()).toBeNull();
			expect(branchModeManager.getBaseBranch()).toBeNull();
			expect(branchModeManager.getCurrentTaskBranch()).toBeNull();
		});

		test("can be called multiple times safely", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setEnabled(true);

			branchModeManager.reset();
			branchModeManager.reset();
			branchModeManager.reset();

			expect(branchModeManager.isEnabled()).toBe(false);
		});
	});

	describe("state isolation", () => {
		test("multiple managers have independent state", () => {
			const manager1 = createBranchModeManager();
			const manager2 = createBranchModeManager();

			manager1.setEnabled(true);
			manager1.setConfig({ enabled: true, branchPrefix: "feature1" });

			manager2.setEnabled(false);
			manager2.setConfig({ enabled: false, branchPrefix: "feature2" });

			expect(manager1.isEnabled()).toBe(true);
			expect(manager1.getConfig()?.branchPrefix).toBe("feature1");

			expect(manager2.isEnabled()).toBe(false);
			expect(manager2.getConfig()?.branchPrefix).toBe("feature2");
		});
	});

	describe("setRalphConfig", () => {
		test("caches ralph config for later use", () => {
			const branchModeManager = createBranchModeManager();

			branchModeManager.setRalphConfig({
				agent: "cursor",
				logFilePath: "/tmp/test.log",
			});

			branchModeManager.setEnabled(true);
			branchModeManager.setConfig({ enabled: true });

			const result = branchModeManager.initialize();

			expect(result.isValid).toBe(true);
		});
	});
});
