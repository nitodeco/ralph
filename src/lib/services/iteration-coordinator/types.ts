import type { RalphConfig } from "@/types.ts";
import type { BranchModeConfig } from "../config/types.ts";

export interface IterationCallbackOptions {
	iterations: number;
	config: RalphConfig;
	skipVerification: boolean;
	branchModeEnabled: boolean;
	branchModeConfig: BranchModeConfig | null;
}

export interface IterationCoordinator {
	setupIterationCallbacks(options: IterationCallbackOptions): void;
	getLastRetryContexts(): import("@/types.ts").IterationLogRetryContext[];
	getLastDecomposition(): import("@/types.ts").DecompositionRequest | null;
	setLastRetryContexts(contexts: import("@/types.ts").IterationLogRetryContext[]): void;
	setLastDecomposition(decomposition: import("@/types.ts").DecompositionRequest | null): void;
	clearState(): void;
}
