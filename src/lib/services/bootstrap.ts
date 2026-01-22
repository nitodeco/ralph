import { createConfigService } from "./config/implementation.ts";
import type { ConfigService } from "./config/types.ts";
import { initializeServices, resetServices, type ServiceContainer } from "./container.ts";
import { createGuardrailsService } from "./guardrails/implementation.ts";
import type { GuardrailsService } from "./guardrails/types.ts";
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
import { createSessionMemoryService } from "./session-memory/implementation.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";
import { createUsageStatisticsService } from "./usage-statistics/implementation.ts";
import type { UsageStatisticsService } from "./usage-statistics/types.ts";

export function bootstrapServices(): void {
	initializeServices({
		projectRegistry: createProjectRegistryService(),
		config: createConfigService(),
		guardrails: createGuardrailsService(),
		rules: createRulesService(),
		prd: createPrdService(),
		sessionMemory: createSessionMemoryService(),
		session: createSessionService(),
		sleepPrevention: createSleepPreventionService(),
		usageStatistics: createUsageStatisticsService(),
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
	sleepPrevention?: Partial<SleepPreventionService>;
	usageStatistics?: Partial<UsageStatisticsService>;
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

	const baseProjectDir = process.cwd();
	const projectStorageDir = `${baseProjectDir}/.ralph`;

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
		getRegistryPath: () => "/tmp/ralph-test/registry.json",
		getProjectsDir: () => "/tmp/ralph-test/projects",
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
		load: () => [],
		save: () => {},
		exists: () => false,
		initialize: () => {},
		invalidate: () => {},
		add: (options) => ({
			id: `rule-${Date.now()}`,
			instruction: options.instruction,
			addedAt: new Date().toISOString(),
		}),
		remove: () => true,
		getById: () => null,
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
		sleepPrevention: createMockSleepPreventionService(overrides.sleepPrevention),
		usageStatistics: createMockUsageStatisticsService(overrides.usageStatistics),
	};

	initializeServices(testContainer);
}

export function teardownTestServices(): void {
	resetServices();
}
