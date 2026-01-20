export { AgentProcessManager } from "./AgentProcessManager.ts";
export {
	bootstrapServices,
	bootstrapTestServices,
	type TestServiceOverrides,
	teardownTestServices,
} from "./bootstrap.ts";

export {
	type ConfigService,
	getConfigService,
	getPrdService,
	getServices,
	getSessionMemoryService,
	getSessionService,
	initializeServices,
	isInitialized,
	type LoadPrdResult,
	type Prd,
	type PrdService,
	type PrdTask,
	resetServices,
	type ServiceContainer,
} from "./container.ts";
export { IterationTimer } from "./IterationTimer.ts";
export type {
	IterationTiming,
	Session,
	SessionService,
	SessionStatistics,
	SessionStatus,
} from "./session/types.ts";
export { VALID_SESSION_STATUSES } from "./session/types.ts";
export type {
	SessionMemory,
	SessionMemoryService,
	SessionMemoryStats,
} from "./session-memory/types.ts";
export { SESSION_MEMORY_CONSTANTS } from "./session-memory/types.ts";
