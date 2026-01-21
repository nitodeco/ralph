import type { ConfigService } from "./config/types.ts";
import type { GuardrailsService } from "./guardrails/types.ts";
import type { PrdService } from "./prd/types.ts";
import type { ProjectRegistryService } from "./project-registry/types.ts";
import type { SleepPreventionService } from "./SleepPreventionService.ts";
import type { SessionService } from "./session/types.ts";
import type { SessionMemoryService } from "./session-memory/types.ts";

export interface ServiceContainer {
	projectRegistry: ProjectRegistryService;
	config: ConfigService;
	guardrails: GuardrailsService;
	prd: PrdService;
	sessionMemory: SessionMemoryService;
	session: SessionService;
	sleepPrevention: SleepPreventionService;
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

export function getGuardrailsService(): GuardrailsService {
	return getServices().guardrails;
}

export function getProjectRegistryService(): ProjectRegistryService {
	return getServices().projectRegistry;
}

export function getSleepPreventionService(): SleepPreventionService {
	return getServices().sleepPrevention;
}
