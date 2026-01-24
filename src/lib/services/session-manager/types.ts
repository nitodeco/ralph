import type { Prd } from "../prd/types.ts";
import type { Session } from "../session/types.ts";

export interface StartSessionResult {
	session: Session;
	taskIndex: number;
}

export interface ResumeSessionResult {
	session: Session;
	remainingIterations: number;
}

export interface FatalErrorResult {
	session: Session | null;
	wasHandled: boolean;
}

export interface SessionManager {
	startSession(prd: Prd | null, totalIterations: number): StartSessionResult;
	resumeSession(pendingSession: Session, prd: Prd | null): ResumeSessionResult;
	handleFatalError(
		error: string,
		prd: Prd | null,
		currentSession: Session | null,
	): FatalErrorResult;
	recordUsageStatistics(
		session: Session,
		prd: Prd | null,
		status: "completed" | "stopped" | "failed",
	): void;
}
