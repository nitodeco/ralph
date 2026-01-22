import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	initializeServices,
	resetServices,
	type ServiceContainer,
} from "@/lib/services/container.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import {
	hasLocalRalphDir,
	migrateLocalRalphDir,
	removeLocalRalphDir,
} from "@/lib/services/project-registry/migration.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";

const TEST_DIR = join(tmpdir(), `ralph-migration-test-${Date.now()}`);
const TEST_RALPH_DIR = join(TEST_DIR, "global-ralph");
const TEST_PROJECTS_DIR = join(TEST_RALPH_DIR, "projects");
const TEST_PROJECT_DIR = join(TEST_DIR, "my-project");
const TEST_LOCAL_RALPH = join(TEST_PROJECT_DIR, ".ralph");

function getTestConfig(): ProjectRegistryConfig {
	return {
		globalDir: TEST_RALPH_DIR,
		registryPath: join(TEST_RALPH_DIR, "registry.json"),
		projectsDir: TEST_PROJECTS_DIR,
	};
}

function createMockServices(
	projectRegistryService: ReturnType<typeof createProjectRegistryService>,
): ServiceContainer {
	const defaultConfig = {
		agent: "cursor" as const,
		maxRetries: 3,
		retryDelayMs: 1000,
		agentTimeoutMs: 300000,
		stuckThresholdMs: 60000,
		maxOutputHistoryBytes: 1048576,
		retryWithContext: true,
		maxDecompositionsPerTask: 3,
		learningEnabled: true,
		verification: { enabled: false, failOnWarning: false },
	};

	return {
		projectRegistry: projectRegistryService,
		config: {
			get: () => defaultConfig,
			load: () => defaultConfig,
			loadGlobal: () => defaultConfig,
			loadGlobalRaw: () => null,
			loadProjectRaw: () => null,
			getWithValidation: (validateFn) => ({
				config: defaultConfig,
				validation: validateFn(defaultConfig),
			}),
			saveGlobal: () => {},
			saveProject: () => {},
			invalidate: () => {},
			invalidateGlobal: () => {},
			invalidateAll: () => {},
			globalConfigExists: () => true,
			getEffective: () => ({ global: null, project: null, effective: defaultConfig }),
		},
		guardrails: {
			get: () => [],
			load: () => [],
			save: () => {},
			exists: () => false,
			initialize: () => {},
			invalidate: () => {},
			add: () => ({
				id: "test",
				instruction: "test",
				trigger: "always" as const,
				category: "quality" as const,
				enabled: true,
				addedAt: new Date().toISOString(),
			}),
			remove: () => true,
			toggle: () => null,
			getById: () => null,
			getActive: () => [],
			formatForPrompt: () => "",
		},
		rules: {
			get: () => [],
			getGlobal: () => [],
			getProject: () => [],
			load: () => [],
			loadGlobal: () => [],
			loadProject: () => [],
			save: () => {},
			saveGlobal: () => {},
			saveProject: () => {},
			exists: () => false,
			existsGlobal: () => false,
			existsProject: () => false,
			initialize: () => {},
			invalidate: () => {},
			invalidateGlobal: () => {},
			invalidateProject: () => {},
			add: () => ({
				id: "test",
				instruction: "test",
				addedAt: new Date().toISOString(),
			}),
			remove: () => true,
			getById: () => null,
			getByIdInScope: () => null,
			formatForPrompt: () => "",
		},
		prd: {
			get: () => null,
			load: () => null,
			loadWithValidation: () => ({ prd: null }),
			reload: () => null,
			reloadWithValidation: () => ({ prd: null }),
			save: () => {},
			invalidate: () => {},
			findFile: () => null,
			isComplete: () => false,
			getNextTask: () => null,
			getNextTaskWithIndex: () => null,
			getTaskByTitle: () => null,
			getTaskByIndex: () => null,
			getCurrentTaskIndex: () => -1,
			canWorkOnTask: () => ({ canWork: true }),
			createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
			loadInstructions: () => null,
		},
		sessionMemory: {
			get: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			load: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			save: () => {},
			exists: () => false,
			initialize: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			invalidate: () => {},
			addLesson: () => {},
			addSuccessPattern: () => {},
			addFailedApproach: () => {},
			addTaskNote: () => {},
			getTaskNote: () => null,
			clear: () => {},
			getStats: () => ({
				lessonsCount: 0,
				patternsCount: 0,
				failedApproachesCount: 0,
				taskNotesCount: 0,
				lastUpdated: null,
			}),
			formatForPrompt: () => "",
			formatForTask: () => "",
			exportAsMarkdown: () => "",
		},
		session: {
			load: () => null,
			save: () => {},
			delete: () => {},
			exists: () => false,
			create: (total, task) => ({
				startTime: Date.now(),
				lastUpdateTime: Date.now(),
				currentIteration: 0,
				totalIterations: total,
				currentTaskIndex: task,
				status: "running" as const,
				elapsedTimeSeconds: 0,
				statistics: {
					totalIterations: total,
					completedIterations: 0,
					failedIterations: 0,
					successfulIterations: 0,
					totalDurationMs: 0,
					averageDurationMs: 0,
					successRate: 0,
					iterationTimings: [],
				},
			}),
			recordIterationStart: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			recordIterationEnd: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			updateIteration: (s, i, t, e) => ({
				...s,
				currentIteration: i,
				currentTaskIndex: t,
				elapsedTimeSeconds: e,
				lastUpdateTime: Date.now(),
			}),
			updateStatus: (s, status) => ({ ...s, status, lastUpdateTime: Date.now() }),
			isResumable: () => false,
			enableParallelMode: (s, max) => ({
				...s,
				parallelState: {
					isParallelMode: true,
					currentGroupIndex: -1,
					executionGroups: [],
					activeExecutions: [],
					maxConcurrentTasks: max,
				},
			}),
			disableParallelMode: (s) => {
				const { parallelState: _, ...rest } = s;

				return rest;
			},
			isParallelMode: (s) => s.parallelState?.isParallelMode ?? false,
			startParallelGroup: (s) => s,
			completeParallelGroup: (s) => s,
			getCurrentParallelGroup: () => null,
			startTaskExecution: (s) => s,
			completeTaskExecution: (s) => s,
			failTaskExecution: (s) => s,
			retryTaskExecution: (s) => s,
			getActiveExecutions: () => [],
			getTaskExecution: () => null,
			isTaskExecuting: () => false,
			getActiveExecutionCount: () => 0,
		},
		sleepPrevention: {
			start: () => {},
			stop: () => {},
			isActive: () => false,
		},
		usageStatistics: {
			get: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			load: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			save: () => {},
			exists: () => false,
			initialize: () => ({
				version: 1,
				projectName: "Test",
				createdAt: new Date().toISOString(),
				lastUpdatedAt: new Date().toISOString(),
				lifetime: {
					totalSessions: 0,
					totalIterations: 0,
					totalTasksCompleted: 0,
					totalTasksAttempted: 0,
					totalDurationMs: 0,
					successfulIterations: 0,
					failedIterations: 0,
					averageIterationsPerSession: 0,
					averageTasksPerSession: 0,
					averageSessionDurationMs: 0,
					overallSuccessRate: 0,
				},
				recentSessions: [],
				dailyUsage: [],
			}),
			invalidate: () => {},
			recordSession: () => {},
			getSummary: () => ({
				totalSessions: 0,
				totalIterations: 0,
				totalTasksCompleted: 0,
				totalDurationMs: 0,
				overallSuccessRate: 0,
				averageSessionDurationMs: 0,
				averageIterationsPerSession: 0,
				lastSessionAt: null,
				streakDays: 0,
			}),
			getRecentSessions: () => [],
			getDailyUsage: () => [],
			formatForDisplay: () => "",
		},
		gitBranch: {
			getCurrentBranch: () => "main",
			getBaseBranch: () => "main",
			hasRemote: () => true,
			getRemoteName: () => "origin",
			getWorkingDirectoryStatus: () => ({
				isClean: true,
				hasUncommittedChanges: false,
				hasUntrackedFiles: false,
				modifiedFiles: [],
				untrackedFiles: [],
			}),
			isWorkingDirectoryClean: () => true,
			createBranch: (branchName: string) => ({
				status: "success" as const,
				message: `Created branch: ${branchName}`,
				branchName,
			}),
			checkoutBranch: (branchName: string) => ({
				status: "success" as const,
				message: `Checked out branch: ${branchName}`,
				branchName,
			}),
			deleteBranch: (branchName: string) => ({
				status: "success" as const,
				message: `Deleted branch: ${branchName}`,
				branchName,
			}),
			createAndCheckoutTaskBranch: (taskTitle: string, taskIndex: number) => {
				const branchName = `ralph/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`;

				return {
					status: "success" as const,
					message: `Created and checked out branch: ${branchName}`,
					branchName,
				};
			},
			commitChanges: () => ({
				status: "success" as const,
				message: "Changes committed successfully",
			}),
			pushBranch: (branchName: string) => ({
				status: "success" as const,
				message: `Pushed branch: ${branchName}`,
				branchName,
			}),
			returnToBaseBranch: (baseBranch: string) => ({
				status: "success" as const,
				message: `Returned to branch: ${baseBranch}`,
				branchName: baseBranch,
			}),
			generateBranchName: (taskTitle: string, taskIndex: number, prefix = "ralph") =>
				`${prefix}/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`,
			getBranchInfo: () => ({
				currentBranch: "main",
				baseBranch: "main",
				hasRemote: true,
				remoteName: "origin",
			}),
			stashChanges: () => ({
				status: "success" as const,
				message: "Changes stashed successfully",
			}),
			popStash: () => ({
				status: "success" as const,
				message: "Stash popped successfully",
			}),
		},
		gitProvider: {
			detectProvider: (remoteUrl: string) => ({
				provider: remoteUrl.includes("github.com") ? ("github" as const) : ("none" as const),
				owner: "test-owner",
				repo: "test-repo",
				hostname: "github.com",
			}),
			getProvider: () => null,
			getProviderForRemote: () => null,
			isProviderConfigured: () => false,
			getSupportedProviders: () => [],
		},
	};
}

const ORIGINAL_CWD = process.cwd();

describe("migration functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}

		mkdirSync(TEST_RALPH_DIR, { recursive: true });
		mkdirSync(TEST_PROJECT_DIR, { recursive: true });
	});

	afterEach(() => {
		try {
			process.chdir(ORIGINAL_CWD);
		} catch {
			// Ignore
		}

		resetServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("hasLocalRalphDir", () => {
		test("returns false when no local .ralph exists", () => {
			expect(hasLocalRalphDir(TEST_PROJECT_DIR)).toBe(false);
		});

		test("returns true when local .ralph exists", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });

			expect(hasLocalRalphDir(TEST_PROJECT_DIR)).toBe(true);
		});
	});

	describe("removeLocalRalphDir", () => {
		test("returns false when no local .ralph exists", () => {
			expect(removeLocalRalphDir(TEST_PROJECT_DIR)).toBe(false);
		});

		test("removes local .ralph directory", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(join(TEST_LOCAL_RALPH, "test.txt"), "test");

			expect(removeLocalRalphDir(TEST_PROJECT_DIR)).toBe(true);
			expect(existsSync(TEST_LOCAL_RALPH)).toBe(false);
		});
	});

	describe("migrateLocalRalphDir", () => {
		test("returns error when services not initialized", () => {
			const result = migrateLocalRalphDir(TEST_PROJECT_DIR);

			expect(result.migrated).toBe(false);
			expect(result.error).toBe("Services not initialized");
		});

		test("returns without migration when no local .ralph exists", () => {
			const projectRegistryService = createProjectRegistryService(getTestConfig());
			const services = createMockServices(projectRegistryService);

			initializeServices(services);

			const result = migrateLocalRalphDir(TEST_PROJECT_DIR);

			expect(result.migrated).toBe(false);
			expect(result.filesMigrated).toEqual([]);
			expect(result.error).toBeUndefined();
		});

		test("migrates files from local to global", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(
				join(TEST_LOCAL_RALPH, "prd.json"),
				JSON.stringify({ project: "Test", tasks: [] }),
			);
			writeFileSync(join(TEST_LOCAL_RALPH, "config.json"), JSON.stringify({ agent: "cursor" }));

			const projectRegistryService = createProjectRegistryService(getTestConfig());
			const services = createMockServices(projectRegistryService);

			initializeServices(services);
			process.chdir(TEST_PROJECT_DIR);

			const result = migrateLocalRalphDir();

			expect(result.migrated).toBe(true);
			expect(result.filesMigrated).toContain("prd.json");
			expect(result.filesMigrated).toContain("config.json");

			expect(existsSync(TEST_LOCAL_RALPH)).toBe(false);

			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				expect(existsSync(join(globalProjectDir, "prd.json"))).toBe(true);
				expect(existsSync(join(globalProjectDir, "config.json"))).toBe(true);

				const prd = JSON.parse(readFileSync(join(globalProjectDir, "prd.json"), "utf-8"));

				expect(prd.project).toBe("Test");
			}
		});

		test("migrates logs directory", () => {
			mkdirSync(join(TEST_LOCAL_RALPH, "logs"), { recursive: true });
			writeFileSync(join(TEST_LOCAL_RALPH, "logs", "iteration-1.log"), "log content");

			const projectRegistryService = createProjectRegistryService(getTestConfig());
			const services = createMockServices(projectRegistryService);

			initializeServices(services);
			process.chdir(TEST_PROJECT_DIR);

			const result = migrateLocalRalphDir();

			expect(result.migrated).toBe(true);
			expect(result.filesMigrated).toContain("logs/iteration-1.log");

			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				expect(existsSync(join(globalProjectDir, "logs", "iteration-1.log"))).toBe(true);
			}
		});

		test("does not overwrite existing files in global directory", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(
				join(TEST_LOCAL_RALPH, "prd.json"),
				JSON.stringify({ project: "Local", tasks: [] }),
			);

			const projectRegistryService = createProjectRegistryService(getTestConfig());
			const services = createMockServices(projectRegistryService);

			initializeServices(services);
			process.chdir(TEST_PROJECT_DIR);

			projectRegistryService.registerProject();
			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				mkdirSync(globalProjectDir, { recursive: true });
				writeFileSync(
					join(globalProjectDir, "prd.json"),
					JSON.stringify({ project: "Global", tasks: [] }),
				);

				const result = migrateLocalRalphDir();

				expect(result.migrated).toBe(true);
				expect(result.filesMigrated).not.toContain("prd.json");

				const prd = JSON.parse(readFileSync(join(globalProjectDir, "prd.json"), "utf-8"));

				expect(prd.project).toBe("Global");
			}
		});
	});
});
