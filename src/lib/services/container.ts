import type { ConfigValidationResult, RalphConfig } from "@/types.ts";

export interface ConfigService {
	get(): RalphConfig;
	load(): RalphConfig;
	loadGlobal(): RalphConfig;
	loadGlobalRaw(): Partial<RalphConfig> | null;
	loadProjectRaw(): Partial<RalphConfig> | null;
	getWithValidation(validateFn: (config: unknown) => ConfigValidationResult): {
		config: RalphConfig;
		validation: ConfigValidationResult;
	};
	saveGlobal(config: RalphConfig): void;
	saveProject(config: RalphConfig): void;
	invalidate(): void;
	invalidateGlobal(): void;
	invalidateAll(): void;
	globalConfigExists(): boolean;
	getEffective(): {
		global: Partial<RalphConfig> | null;
		project: Partial<RalphConfig> | null;
		effective: RalphConfig;
	};
}

export interface LoadPrdResult {
	prd: Prd | null;
	validationError?: string;
}

export interface Prd {
	project: string;
	tasks: PrdTask[];
}

export interface PrdTask {
	title: string;
	description: string;
	steps: string[];
	done: boolean;
}

export interface PrdService {
	get(verbose?: boolean): Prd | null;
	load(verbose?: boolean): Prd | null;
	loadWithValidation(): LoadPrdResult;
	reload(verbose?: boolean): Prd | null;
	reloadWithValidation(): LoadPrdResult;
	save(prd: Prd): void;
	invalidate(): void;
	findPrdFile(): string | null;
}

export interface ServiceContainer {
	config: ConfigService;
	prd: PrdService;
}

let container: ServiceContainer | null = null;

export function initializeServices(services: ServiceContainer): void {
	if (container !== null) {
		throw new Error(
			"Services have already been initialized. Call resetServices() first to reinitialize.",
		);
	}

	container = services;
}

export function getServices(): ServiceContainer {
	if (container === null) {
		throw new Error("Services have not been initialized. Call bootstrapServices() first.");
	}

	return container;
}

export function resetServices(): void {
	container = null;
}

export function isInitialized(): boolean {
	return container !== null;
}

export function getConfigService(): ConfigService {
	return getServices().config;
}

export function getPrdService(): PrdService {
	return getServices().prd;
}
