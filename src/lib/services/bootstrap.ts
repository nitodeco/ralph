import { tmpdir } from "node:os";
import { join } from "node:path";
import { createBranchModeManager } from "./branch-mode-manager/implementation.ts";
import type { BranchModeManager } from "./branch-mode-manager/types.ts";
import { createConfigService } from "./config/implementation.ts";
import type { ConfigService } from "./config/types.ts";
import { initializeServices, resetServices, type ServiceContainer } from "./container.ts";
import { createGitBranchService } from "./git-branch/implementation.ts";
import type { GitBranchService } from "./git-branch/types.ts";
import { createGitHubProvider } from "./git-provider/github-provider.ts";
import { createGitProviderService, registerProvider } from "./git-provider/implementation.ts";
import type { GitProviderService } from "./git-provider/types.ts";
import { createGuardrailsService } from "./guardrails/implementation.ts";
import type { GuardrailsService } from "./guardrails/types.ts";
import { createHandlerCoordinator } from "./handler-coordinator/implementation.ts";
import type { HandlerCoordinator } from "./handler-coordinator/types.ts";
import { createIterationCoordinator } from "./iteration-coordinator/implementation.ts";
import type { IterationCoordinator } from "./iteration-coordinator/types.ts";
import { createParallelExecutionManager } from "./parallel-execution-manager/implementation.ts";
import type { ParallelExecutionManager } from "./parallel-execution-manager/types.ts";
import { createPrdService } from "./prd/implementation.ts";
import type { PrdService } from "./prd/types.ts";
import { createProjectRegistryService } from "./project-registry/implementation.ts";
import type {
	ProjectIdentifier,
	ProjectRegistry,
	ProjectRegistryService,
} from "./project-registry/types.ts";
import { createRulesService } from "./rules/implementation.ts";
import type { RulesService } from "./rules/types.ts";
import {
	createSleepPreventionService,
	type SleepPreventionService,
} from "./SleepPreventionService.ts";
import { createSessionService } from "./session/implementation.ts";
import type { SessionService } from "./session/types.ts";
import { createSessionManager } from "./session-manager/implementation.ts";
import type { SessionManager } from "./session-manager/types.ts";
import { createSessionMemoryService } from "./session-memory/implementation.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";
import { createUsageStatisticsService } from "./usage-statistics/implementation.ts";
import type { UsageStatisticsService } from "./usage-statistics/types.ts";

export interface SessionManagerStoreDependencies {
	getAgentStoreState: () => {
		exitCode: number | null;
		retryCount: number;
		output: string;
	};
	getIterationStoreState: () => {
		current: number;
	};
}

export interface IterationCoordinatorStoreDependencies {
	getAppStoreState: () => {
		prd: import("./prd/types.ts").Prd | null;
		currentSession: import("./session/types.ts").Session | null;
		elapsedTime: number;
		manualNextTask: string | null;
		isVerifying: boolean;
		isReviewingTechnicalDebt: boolean;
		lastVerificationResult: import("@/types.ts").VerificationResult | null;
		lastTechnicalDebtReport:
			| import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
			| null;
		lastDecomposition: import("@/types.ts").DecompositionRequest | null;
		getEffectiveNextTask: () => string | null;
		clearManualNextTask: () => void;
		setPrd: (prd: import("./prd/types.ts").Prd) => void;
	};
	setAppStoreState: (
		state: Partial<{
			prd: import("./prd/types.ts").Prd | null;
			currentSession: import("./session/types.ts").Session | null;
			isVerifying: boolean;
			isReviewingTechnicalDebt: boolean;
			lastVerificationResult: import("@/types.ts").VerificationResult | null;
			lastTechnicalDebtReport:
				| import("@/lib/handlers/TechnicalDebtHandler.ts").TechnicalDebtReport
				| null;
			lastDecomposition: import("@/types.ts").DecompositionRequest | null;
			appState: import("@/types.ts").AppState;
		}>,
	) => void;
	getAgentStoreState: () => {
		isComplete: boolean;
		error: string | null;
		output: string;
		exitCode: number | null;
		retryCount: number;
		reset: () => void;
	};
	getIterationStoreState: () => {
		current: number;
		total: number;
		setCallbacks: (callbacks: {
			onIterationStart?: (iteration: number) => void;
			onIterationComplete?: (iteration: number) => void;
			onAllComplete?: () => void;
			onMaxIterations?: () => void;
			onMaxRuntime?: () => void;
		}) => void;
		restartCurrentIteration: () => void;
	};
	startAgent: (specificTask?: string | null) => void;
	stopAgent: () => void;
	resetAgent: () => void;
	createTaskBranch: (taskTitle: string, taskIndex: number) => { success: boolean; error?: string };
	completeTaskBranch: (
		prd: import("./prd/types.ts").Prd | null,
	) => Promise<{ success: boolean; error?: string; prUrl?: string }>;
}

export interface ParallelExecutionManagerStoreDependencies {
	getAppStoreState: () => {
		prd: import("./prd/types.ts").Prd | null;
		currentSession: import("./session/types.ts").Session | null;
	};
	setAppStoreState: (
		state: Partial<{
			currentSession: import("./session/types.ts").Session | null;
		}>,
	) => void;
}

let sessionManagerDependencies: SessionManagerStoreDependencies | null = null;
let iterationCoordinatorDependencies: IterationCoordinatorStoreDependencies | null = null;
let parallelExecutionManagerDependencies: ParallelExecutionManagerStoreDependencies | null = null;

export function setSessionManagerDependencies(dependencies: SessionManagerStoreDependencies): void {
	sessionManagerDependencies = dependencies;
}

export function setIterationCoordinatorDependencies(
	dependencies: IterationCoordinatorStoreDependencies,
): void {
	iterationCoordinatorDependencies = dependencies;
}

export function setParallelExecutionManagerDependencies(
	dependencies: ParallelExecutionManagerStoreDependencies,
): void {
	parallelExecutionManagerDependencies = dependencies;
}

export function bootstrapServices(): void {
	registerProvider("github", createGitHubProvider);

	const sessionManagerDeps: SessionManagerStoreDependencies = {
		getAgentStoreState: () => {
			if (!sessionManagerDependencies) {
				return { exitCode: null, retryCount: 0, output: "" };
			}

			return sessionManagerDependencies.getAgentStoreState();
		},
		getIterationStoreState: () => {
			if (!sessionManagerDependencies) {
				return { current: 0 };
			}

			return sessionManagerDependencies.getIterationStoreState();
		},
	};

	const iterationCoordinatorDeps: IterationCoordinatorStoreDependencies = {
		getAppStoreState: () => {
			if (!iterationCoordinatorDependencies) {
				return {
					prd: null,
					currentSession: null,
					elapsedTime: 0,
					manualNextTask: null,
					isVerifying: false,
					isReviewingTechnicalDebt: false,
					lastVerificationResult: null,
					lastTechnicalDebtReport: null,
					lastDecomposition: null,
					getEffectiveNextTask: () => null,
					clearManualNextTask: () => {},
					setPrd: () => {},
				};
			}

			return iterationCoordinatorDependencies.getAppStoreState();
		},
		setAppStoreState: (state) => {
			if (iterationCoordinatorDependencies) {
				iterationCoordinatorDependencies.setAppStoreState(state);
			}
		},
		getAgentStoreState: () => {
			if (!iterationCoordinatorDependencies) {
				return {
					isComplete: false,
					error: null,
					output: "",
					exitCode: null,
					retryCount: 0,
					reset: () => {},
				};
			}

			return iterationCoordinatorDependencies.getAgentStoreState();
		},
		getIterationStoreState: () => {
			if (!iterationCoordinatorDependencies) {
				return {
					current: 0,
					total: 0,
					setCallbacks: () => {},
					restartCurrentIteration: () => {},
				};
			}

			return iterationCoordinatorDependencies.getIterationStoreState();
		},
		startAgent: (specificTask) => {
			if (iterationCoordinatorDependencies) {
				iterationCoordinatorDependencies.startAgent(specificTask);
			}
		},
		stopAgent: () => {
			if (iterationCoordinatorDependencies) {
				iterationCoordinatorDependencies.stopAgent();
			}
		},
		resetAgent: () => {
			if (iterationCoordinatorDependencies) {
				iterationCoordinatorDependencies.resetAgent();
			}
		},
		createTaskBranch: (taskTitle, taskIndex) => {
			if (!iterationCoordinatorDependencies) {
				return { success: true };
			}

			return iterationCoordinatorDependencies.createTaskBranch(taskTitle, taskIndex);
		},
		completeTaskBranch: async (prd) => {
			if (!iterationCoordinatorDependencies) {
				return { success: true };
			}

			return iterationCoordinatorDependencies.completeTaskBranch(prd);
		},
	};

	const parallelExecutionManagerDeps: ParallelExecutionManagerStoreDependencies = {
		getAppStoreState: () => {
			if (!parallelExecutionManagerDependencies) {
				return {
					prd: null,
					currentSession: null,
				};
			}

			return parallelExecutionManagerDependencies.getAppStoreState();
		},
		setAppStoreState: (state) => {
			if (parallelExecutionManagerDependencies) {
				parallelExecutionManagerDependencies.setAppStoreState(state);
			}
		},
	};

	initializeServices({
		projectRegistry: createProjectRegistryService(),
		config: createConfigService(),
		guardrails: createGuardrailsService(),
		rules: createRulesService(),
		prd: createPrdService(),
		sessionMemory: createSessionMemoryService(),
		session: createSessionService(),
		sessionManager: createSessionManager(sessionManagerDeps),
		iterationCoordinator: createIterationCoordinator(iterationCoordinatorDeps),
		parallelExecutionManager: createParallelExecutionManager(parallelExecutionManagerDeps),
		branchModeManager: createBranchModeManager(),
		handlerCoordinator: createHandlerCoordinator(),
		sleepPrevention: createSleepPreventionService(),
		usageStatistics: createUsageStatisticsService(),
		gitBranch: createGitBranchService(),
		gitProvider: createGitProviderService(),
	});
}

export interface TestServiceOverrides {
	projectRegistry?: Partial<ProjectRegistryService>;
	config?: Partial<ConfigService>;
	guardrails?: Partial<GuardrailsService>;
	rules?: Partial<RulesService>;
	prd?: Partial<PrdService>;
	sessionMemory?: Partial<SessionMemoryService>;
	session?: Partial<SessionService>;
	sessionManager?: Partial<SessionManager>;
	iterationCoordinator?: Partial<IterationCoordinator>;
	parallelExecutionManager?: Partial<ParallelExecutionManager>;
	branchModeManager?: Partial<BranchModeManager>;
	handlerCoordinator?: Partial<HandlerCoordinator>;
	sleepPrevention?: Partial<SleepPreventionService>;
	usageStatistics?: Partial<UsageStatisticsService>;
	gitBranch?: Partial<GitBranchService>;
	gitProvider?: Partial<GitProviderService>;
}

function createMockProjectRegistryService(
	overrides: Partial<ProjectRegistryService> = {},
): ProjectRegistryService {
	const testIdentifier: ProjectIdentifier = {
		type: "path",
		value: "/tmp/test-project",
		folderName: "path--test-project",
	};

	const emptyRegistry: ProjectRegistry = {
		version: 1,
		projects: {},
		pathCache: {},
	};

	const currentWorkingDir = process.cwd();
	const isInTempDir =
		currentWorkingDir.startsWith(tmpdir()) || currentWorkingDir.startsWith("/tmp");
	const projectStorageDir = isInTempDir
		? join(currentWorkingDir, ".ralph")
		: join(tmpdir(), "ralph-mock");
	const baseMockDir = isInTempDir ? currentWorkingDir : join(tmpdir(), "ralph-mock");

	return {
		loadRegistry: () => emptyRegistry,
		saveRegistry: () => {},
		ensureProjectsDir: () => {},
		resolveCurrentProject: () => testIdentifier,
		registerProject: () => testIdentifier,
		getProjectDir: () => projectStorageDir,
		getProjectFilePath: (relativePath: string) => `${projectStorageDir}/${relativePath}`,
		listProjects: () => [],
		getProjectMetadata: () => null,
		updateLastAccessed: () => {},
		isProjectInitialized: () => true,
		removeProject: () => true,
		getRegistryPath: () => join(baseMockDir, "registry.json"),
		getProjectsDir: () => join(baseMockDir, "projects"),
		...overrides,
	};
}

function createMockConfigService(overrides: Partial<ConfigService> = {}): ConfigService {
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
		verification: {
			enabled: false,
			failOnWarning: false,
		},
	};

	return {
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
		getEffective: () => ({
			global: null,
			project: null,
			effective: defaultConfig,
		}),
		hasAcknowledgedWarning: () => true,
		acknowledgeWarning: () => {},
		...overrides,
	};
}

function createMockPrdService(overrides: Partial<PrdService> = {}): PrdService {
	return {
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
		toggleTaskDone: (prd) => prd,
		deleteTask: (prd) => prd,
		reorderTask: (prd) => prd,
		updateTask: (prd) => prd,
		...overrides,
	};
}

function createMockSessionMemoryService(
	overrides: Partial<SessionMemoryService> = {},
): SessionMemoryService {
	const emptyMemory = {
		projectName: "Test Project",
		lessonsLearned: [],
		successfulPatterns: [],
		failedApproaches: [],
		taskNotes: {},
		lastUpdated: new Date().toISOString(),
	};

	return {
		get: () => emptyMemory,
		load: () => emptyMemory,
		save: () => {},
		exists: () => false,
		initialize: () => emptyMemory,
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
		...overrides,
	};
}

function createMockSessionService(overrides: Partial<SessionService> = {}): SessionService {
	const createMockSession = (totalIterations: number, currentTaskIndex: number) => ({
		startTime: Date.now(),
		lastUpdateTime: Date.now(),
		currentIteration: 0,
		totalIterations,
		currentTaskIndex,
		status: "running" as const,
		elapsedTimeSeconds: 0,
		statistics: {
			totalIterations,
			completedIterations: 0,
			failedIterations: 0,
			successfulIterations: 0,
			totalDurationMs: 0,
			averageDurationMs: 0,
			successRate: 0,
			iterationTimings: [],
		},
	});

	return {
		load: () => null,
		save: () => {},
		delete: () => {},
		exists: () => false,
		create: createMockSession,
		recordIterationStart: (session) => ({ ...session, lastUpdateTime: Date.now() }),
		recordIterationEnd: (session) => ({ ...session, lastUpdateTime: Date.now() }),
		updateIteration: (session, currentIteration, currentTaskIndex, elapsedTimeSeconds) => ({
			...session,
			currentIteration,
			currentTaskIndex,
			elapsedTimeSeconds,
			lastUpdateTime: Date.now(),
		}),
		updateStatus: (session, status) => ({ ...session, status, lastUpdateTime: Date.now() }),
		isResumable: () => false,
		enableParallelMode: (session, maxConcurrentTasks) => ({
			...session,
			lastUpdateTime: Date.now(),
			parallelState: {
				isParallelMode: true,
				currentGroupIndex: -1,
				executionGroups: [],
				activeExecutions: [],
				maxConcurrentTasks,
			},
		}),
		disableParallelMode: (session) => {
			const { parallelState: _, ...rest } = session;

			return { ...rest, lastUpdateTime: Date.now() };
		},
		isParallelMode: (session) => session.parallelState?.isParallelMode ?? false,
		startParallelGroup: (session) => session,
		completeParallelGroup: (session) => session,
		getCurrentParallelGroup: () => null,
		startTaskExecution: (session) => session,
		completeTaskExecution: (session) => session,
		failTaskExecution: (session) => session,
		retryTaskExecution: (session) => session,
		getActiveExecutions: () => [],
		getTaskExecution: () => null,
		isTaskExecuting: () => false,
		getActiveExecutionCount: () => 0,
		...overrides,
	};
}

function createMockGuardrailsService(
	overrides: Partial<GuardrailsService> = {},
): GuardrailsService {
	const defaultGuardrails = [
		{
			id: "verify-before-commit",
			instruction: "Verify changes work before committing",
			trigger: "always" as const,
			category: "quality" as const,
			enabled: true,
			addedAt: new Date().toISOString(),
		},
	];

	return {
		get: () => defaultGuardrails,
		load: () => defaultGuardrails,
		save: () => {},
		exists: () => false,
		initialize: () => {},
		invalidate: () => {},
		add: (options) => ({
			id: `guardrail-${Date.now()}`,
			instruction: options.instruction,
			trigger: options.trigger ?? "always",
			category: options.category ?? "quality",
			enabled: options.enabled ?? true,
			addedAt: new Date().toISOString(),
			addedAfterFailure: options.addedAfterFailure,
		}),
		remove: () => true,
		toggle: () => null,
		getById: () => null,
		getActive: () => defaultGuardrails,
		formatForPrompt: () => "",
		...overrides,
	};
}

function createMockRulesService(overrides: Partial<RulesService> = {}): RulesService {
	return {
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
		add: (options) => ({
			id: `rule-${Date.now()}`,
			instruction: options.instruction,
			addedAt: new Date().toISOString(),
		}),
		remove: () => true,
		getById: () => null,
		getByIdInScope: () => null,
		formatForPrompt: () => "",
		...overrides,
	};
}

function createMockSleepPreventionService(
	overrides: Partial<SleepPreventionService> = {},
): SleepPreventionService {
	return {
		start: () => {},
		stop: () => {},
		isActive: () => false,
		...overrides,
	};
}

function createMockUsageStatisticsService(
	overrides: Partial<UsageStatisticsService> = {},
): UsageStatisticsService {
	const emptyStatistics = {
		version: 1,
		projectName: "Test Project",
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
	};

	return {
		get: () => emptyStatistics,
		load: () => emptyStatistics,
		save: () => {},
		exists: () => false,
		initialize: () => emptyStatistics,
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
		...overrides,
	};
}

function createMockGitBranchService(overrides: Partial<GitBranchService> = {}): GitBranchService {
	return {
		getCurrentBranch: () => "main",
		getBaseBranch: () => "main",
		hasRemote: () => true,
		getRemoteName: () => "origin",
		getRemoteUrl: () => "git@github.com:test-org/test-repo.git",
		getWorkingDirectoryStatus: () => ({
			isClean: true,
			hasUncommittedChanges: false,
			hasUntrackedFiles: false,
			modifiedFiles: [],
			untrackedFiles: [],
		}),
		isWorkingDirectoryClean: () => true,
		createBranch: (branchName) => ({
			status: "success",
			message: `Created branch: ${branchName}`,
			branchName,
		}),
		checkoutBranch: (branchName) => ({
			status: "success",
			message: `Checked out branch: ${branchName}`,
			branchName,
		}),
		deleteBranch: (branchName) => ({
			status: "success",
			message: `Deleted branch: ${branchName}`,
			branchName,
		}),
		createAndCheckoutTaskBranch: (taskTitle, taskIndex) => {
			const branchName = `ralph/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`;

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
		pushBranch: (branchName) => ({
			status: "success",
			message: `Pushed branch: ${branchName}`,
			branchName,
		}),
		returnToBaseBranch: (baseBranch) => ({
			status: "success",
			message: `Returned to branch: ${baseBranch}`,
			branchName: baseBranch,
		}),
		generateBranchName: (taskTitle, taskIndex, prefix = "ralph") =>
			`${prefix}/task-${taskIndex + 1}-${taskTitle.toLowerCase().replace(/\s+/g, "-")}`,
		getBranchInfo: () => ({
			currentBranch: "main",
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
		...overrides,
	};
}

function createMockGitProviderService(
	overrides: Partial<GitProviderService> = {},
): GitProviderService {
	return {
		detectProvider: (remoteUrl) => ({
			provider: remoteUrl.includes("github.com") ? "github" : "none",
			owner: "test-owner",
			repo: "test-repo",
			hostname: "github.com",
		}),
		getProvider: () => null,
		getProviderForRemote: () => null,
		isProviderConfigured: () => false,
		getSupportedProviders: () => [],
		...overrides,
	};
}

function createMockSessionManager(overrides: Partial<SessionManager> = {}): SessionManager {
	const createMockSession = (totalIterations: number, currentTaskIndex: number) => ({
		startTime: Date.now(),
		lastUpdateTime: Date.now(),
		currentIteration: 0,
		totalIterations,
		currentTaskIndex,
		status: "running" as const,
		elapsedTimeSeconds: 0,
		statistics: {
			totalIterations,
			completedIterations: 0,
			failedIterations: 0,
			successfulIterations: 0,
			totalDurationMs: 0,
			averageDurationMs: 0,
			successRate: 0,
			iterationTimings: [],
		},
	});

	return {
		startSession: (_prd, totalIterations) => ({
			session: createMockSession(totalIterations, 0),
			taskIndex: 0,
		}),
		resumeSession: (pendingSession) => ({
			session: { ...pendingSession, status: "running" as const },
			remainingIterations: pendingSession.totalIterations - pendingSession.currentIteration,
		}),
		handleFatalError: (_error, _prd, currentSession) => ({
			session: currentSession ? { ...currentSession, status: "stopped" as const } : null,
			wasHandled: true,
		}),
		recordUsageStatistics: () => {},
		...overrides,
	};
}

function createMockIterationCoordinator(
	overrides: Partial<IterationCoordinator> = {},
): IterationCoordinator {
	return {
		setupIterationCallbacks: () => {},
		getLastRetryContexts: () => [],
		getLastDecomposition: () => null,
		setLastRetryContexts: () => {},
		setLastDecomposition: () => {},
		clearState: () => {},
		...overrides,
	};
}

function createMockParallelExecutionManager(
	overrides: Partial<ParallelExecutionManager> = {},
): ParallelExecutionManager {
	return {
		isEnabled: () => false,
		getConfig: () => ({ enabled: false, maxConcurrentTasks: 1 }),
		getCurrentGroup: () => null,
		getExecutionGroups: () => [],
		initialize: () => ({ isValid: true }),
		startNextGroup: () => ({ started: false, groupIndex: -1, tasks: [] }),
		recordTaskStart: () => {},
		recordTaskComplete: () => ({ groupComplete: true, allSucceeded: true }),
		getReadyTasks: () => [],
		hasMoreGroups: () => false,
		getSummary: () => ({
			totalGroups: 0,
			completedGroups: 0,
			currentGroupIndex: 0,
			isActive: false,
		}),
		disable: () => {},
		reset: () => {},
		...overrides,
	};
}

function createMockBranchModeManager(
	overrides: Partial<BranchModeManager> = {},
): BranchModeManager {
	return {
		isEnabled: () => false,
		getConfig: () => null,
		getBaseBranch: () => null,
		getCurrentTaskBranch: () => null,
		setEnabled: () => {},
		setConfig: () => {},
		initialize: () => ({ isValid: true }),
		createTaskBranch: () => ({ success: true }),
		completeTaskBranch: async () => ({ success: true }),
		createPullRequestForBranch: async () => ({ success: true }),
		reset: () => {},
		...overrides,
	};
}

function createMockHandlerCoordinator(
	overrides: Partial<HandlerCoordinator> = {},
): HandlerCoordinator {
	return {
		initialize: () => {},
		getIsVerifying: () => false,
		cleanup: () => {},
		...overrides,
	};
}

export function bootstrapTestServices(overrides: TestServiceOverrides = {}): void {
	resetServices();

	const testContainer: ServiceContainer = {
		projectRegistry: createMockProjectRegistryService(overrides.projectRegistry),
		config: createMockConfigService(overrides.config),
		guardrails: createMockGuardrailsService(overrides.guardrails),
		rules: createMockRulesService(overrides.rules),
		prd: createMockPrdService(overrides.prd),
		sessionMemory: createMockSessionMemoryService(overrides.sessionMemory),
		session: createMockSessionService(overrides.session),
		sessionManager: createMockSessionManager(overrides.sessionManager),
		iterationCoordinator: createMockIterationCoordinator(overrides.iterationCoordinator),
		parallelExecutionManager: createMockParallelExecutionManager(
			overrides.parallelExecutionManager,
		),
		branchModeManager: createMockBranchModeManager(overrides.branchModeManager),
		handlerCoordinator: createMockHandlerCoordinator(overrides.handlerCoordinator),
		sleepPrevention: createMockSleepPreventionService(overrides.sleepPrevention),
		usageStatistics: createMockUsageStatisticsService(overrides.usageStatistics),
		gitBranch: createMockGitBranchService(overrides.gitBranch),
		gitProvider: createMockGitProviderService(overrides.gitProvider),
	};

	initializeServices(testContainer);
}

export function teardownTestServices(): void {
	resetServices();
}
