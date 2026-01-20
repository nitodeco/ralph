import { ConfigService as ConfigServiceSingleton } from "./ConfigService.ts";
import {
	type ConfigService,
	initializeServices,
	type PrdService,
	resetServices,
	type ServiceContainer,
} from "./container.ts";
import { PrdService as PrdServiceSingleton } from "./PrdService.ts";
import { createSessionService } from "./session/implementation.ts";
import type { SessionService } from "./session/types.ts";
import { createSessionMemoryService } from "./session-memory/implementation.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";

export function bootstrapServices(): void {
	initializeServices({
		config: ConfigServiceSingleton as ConfigService,
		prd: PrdServiceSingleton as PrdService,
		sessionMemory: createSessionMemoryService(),
		session: createSessionService(),
	});
}

export interface TestServiceOverrides {
	config?: Partial<ConfigService>;
	prd?: Partial<PrdService>;
	sessionMemory?: Partial<SessionMemoryService>;
	session?: Partial<SessionService>;
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
		findPrdFile: () => null,
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
		...overrides,
	};
}

export function bootstrapTestServices(overrides: TestServiceOverrides = {}): void {
	resetServices();

	const testContainer: ServiceContainer = {
		config: createMockConfigService(overrides.config),
		prd: createMockPrdService(overrides.prd),
		sessionMemory: createMockSessionMemoryService(overrides.sessionMemory),
		session: createMockSessionService(overrides.session),
	};

	initializeServices(testContainer);
}

export function teardownTestServices(): void {
	resetServices();
}
