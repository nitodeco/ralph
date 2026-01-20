import type { ConfigService } from "./config/types.ts";
import type { SessionService } from "./session/types.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";

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
	sessionMemory: SessionMemoryService;
	session: SessionService;
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

export function getSessionMemoryService(): SessionMemoryService {
	return getServices().sessionMemory;
}

export function getSessionService(): SessionService {
	return getServices().session;
}
