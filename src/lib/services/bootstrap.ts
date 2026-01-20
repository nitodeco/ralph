import { ConfigService as ConfigServiceSingleton } from "./ConfigService.ts";
import {
	type ConfigService,
	initializeServices,
	type PrdService,
	resetServices,
	type ServiceContainer,
} from "./container.ts";
import { PrdService as PrdServiceSingleton } from "./PrdService.ts";

export function bootstrapServices(): void {
	initializeServices({
		config: ConfigServiceSingleton as ConfigService,
		prd: PrdServiceSingleton as PrdService,
	});
}

export interface TestServiceOverrides {
	config?: Partial<ConfigService>;
	prd?: Partial<PrdService>;
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

export function bootstrapTestServices(overrides: TestServiceOverrides = {}): void {
	resetServices();

	const testContainer: ServiceContainer = {
		config: createMockConfigService(overrides.config),
		prd: createMockPrdService(overrides.prd),
	};

	initializeServices(testContainer);
}

export function teardownTestServices(): void {
	resetServices();
}
