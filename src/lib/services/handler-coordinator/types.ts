import type { RalphConfig, VerificationResult } from "@/types.ts";
import type { Prd } from "../prd/types.ts";
import type { Session } from "../session/types.ts";

export interface HandlerCoordinatorConfig {
	config: RalphConfig;
	skipVerification: boolean;
}

export interface HandlerCoordinatorCallbacks {
	onPrdUpdate: (prd: Prd) => void;
	onRestartIteration: () => void;
	onVerificationStateChange: (isVerifying: boolean, result: VerificationResult | null) => void;
	onIterationComplete: (allTasksDone: boolean, hasPendingTasks: boolean) => void;
	onFatalError: (error: string, prd: Prd | null, currentSession: Session | null) => void;
	onAppStateChange: (state: "error") => void;
}

export interface HandlerCoordinator {
	initialize(config: HandlerCoordinatorConfig, callbacks: HandlerCoordinatorCallbacks): void;
	getIsVerifying(): boolean;
	cleanup(): void;
}
