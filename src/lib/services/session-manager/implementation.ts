import {
	appendIterationError,
	completeIterationLog,
	generateSessionId,
	initializeLogsIndex,
} from "@/lib/iteration-logs.ts";
import { getLogger } from "@/lib/logger.ts";
import { sendNotifications } from "@/lib/notifications.ts";
import { initializeProgressFile } from "@/lib/progress.ts";
import type { RalphConfig } from "@/types.ts";
import {
	getConfigService,
	getPrdService,
	getSessionMemoryService,
	getSessionService,
	getUsageStatisticsService,
} from "../container.ts";
import type { Prd } from "../prd/types.ts";
import type { Session } from "../session/types.ts";
import type {
	FatalErrorResult,
	ResumeSessionResult,
	SessionManager,
	StartSessionResult,
} from "./types.ts";

export interface SessionManagerDependencies {
	getAgentStoreState: () => {
		exitCode: number | null;
		retryCount: number;
		output: string;
	};
	getIterationStoreState: () => {
		current: number;
	};
}

export function createSessionManager(dependencies: SessionManagerDependencies): SessionManager {
	let cachedConfig: RalphConfig | null = null;

	function setConfig(config: RalphConfig): void {
		cachedConfig = config;
	}

	function recordUsageStatistics(
		session: Session,
		prd: Prd | null,
		status: "completed" | "stopped" | "failed",
	): void {
		const usageStatisticsService = getUsageStatisticsService();
		const completedTasks = prd?.tasks.filter((task) => task.done).length ?? 0;
		const attemptedTasks = prd?.tasks.length ?? 0;
		const durationMs = Date.now() - session.startTime;

		usageStatisticsService.initialize(prd?.project ?? "Unknown Project");
		usageStatisticsService.recordSession({
			sessionId: `session-${session.startTime}`,
			startedAt: new Date(session.startTime).toISOString(),
			completedAt: new Date().toISOString(),
			durationMs,
			totalIterations: session.statistics.totalIterations,
			completedIterations: session.statistics.completedIterations,
			successfulIterations: session.statistics.successfulIterations,
			failedIterations: session.statistics.failedIterations,
			tasksCompleted: completedTasks,
			tasksAttempted: attemptedTasks,
			status,
		});
	}

	function startSession(prd: Prd | null, totalIterations: number): StartSessionResult {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const sessionService = getSessionService();
		const prdService = getPrdService();

		const taskIndex = prd ? prdService.getCurrentTaskIndex(prd) : 0;
		const newSession = sessionService.create(totalIterations, taskIndex);

		sessionService.save(newSession);

		logger.logSessionStart(totalIterations, taskIndex);
		initializeProgressFile();

		const sessionId = generateSessionId();

		initializeLogsIndex(sessionId, prd?.project ?? "Unknown Project");

		getSessionMemoryService().initialize(prd?.project ?? "Unknown Project");

		return { session: newSession, taskIndex };
	}

	function resumeSession(pendingSession: Session, _prd: Prd | null): ResumeSessionResult {
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const sessionService = getSessionService();

		const remainingIterations = pendingSession.totalIterations - pendingSession.currentIteration;
		const resumedSession = sessionService.updateStatus(pendingSession, "running");

		sessionService.save(resumedSession);

		logger.logSessionResume(
			pendingSession.currentIteration,
			pendingSession.totalIterations,
			pendingSession.elapsedTimeSeconds,
		);

		return {
			session: resumedSession,
			remainingIterations: remainingIterations > 0 ? remainingIterations : 1,
		};
	}

	function handleFatalError(
		error: string,
		prd: Prd | null,
		currentSession: Session | null,
	): FatalErrorResult {
		const iterationState = dependencies.getIterationStoreState();
		const agentStoreState = dependencies.getAgentStoreState();
		const config = cachedConfig ?? getConfigService().get();
		const logger = getLogger({ logFilePath: config.logFilePath });

		logger.error("Fatal error occurred", { error });
		sendNotifications(config.notifications, "fatal_error", prd?.project, { error });

		appendIterationError(iterationState.current, error, { fatal: true });
		completeIterationLog({
			iteration: iterationState.current,
			status: "failed",
			exitCode: agentStoreState.exitCode,
			retryCount: agentStoreState.retryCount,
			outputLength: agentStoreState.output.length,
			taskWasCompleted: false,
		});

		if (currentSession) {
			recordUsageStatistics(currentSession, prd, "failed");

			const sessionService = getSessionService();
			const stoppedSession = sessionService.updateStatus(currentSession, "stopped");

			sessionService.save(stoppedSession);

			return { session: stoppedSession, wasHandled: true };
		}

		return { session: null, wasHandled: true };
	}

	return {
		setConfig,
		startSession,
		resumeSession,
		handleFatalError,
		recordUsageStatistics,
	};
}
