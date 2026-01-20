import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import type { IterationTiming, Session, SessionStatistics, SessionStatus } from "@/types.ts";
import { ensureRalphDirExists, SESSION_FILE_PATH } from "./paths.ts";

export { SESSION_FILE_PATH } from "./paths.ts";

export function loadSession(): Session | null {
	if (!existsSync(SESSION_FILE_PATH)) {
		return null;
	}

	try {
		const content = readFileSync(SESSION_FILE_PATH, "utf-8");
		const session = JSON.parse(content) as Session;

		if (!session.statistics) {
			session.statistics = createInitialStatistics(session.totalIterations);
			saveSession(session);
		}

		return session;
	} catch {
		return null;
	}
}

export function saveSession(session: Session): void {
	ensureRalphDirExists();
	writeFileSync(SESSION_FILE_PATH, JSON.stringify(session, null, 2));
}

export function deleteSession(): void {
	if (existsSync(SESSION_FILE_PATH)) {
		unlinkSync(SESSION_FILE_PATH);
	}
}

export function sessionExists(): boolean {
	return existsSync(SESSION_FILE_PATH);
}

function createInitialStatistics(totalIterations: number): SessionStatistics {
	return {
		totalIterations,
		completedIterations: 0,
		failedIterations: 0,
		successfulIterations: 0,
		totalDurationMs: 0,
		averageDurationMs: 0,
		successRate: 0,
		iterationTimings: [],
	};
}

export function createSession(totalIterations: number, currentTaskIndex: number): Session {
	const now = Date.now();

	return {
		startTime: now,
		lastUpdateTime: now,
		currentIteration: 0,
		totalIterations,
		currentTaskIndex,
		status: "running",
		elapsedTimeSeconds: 0,
		statistics: createInitialStatistics(totalIterations),
	};
}

export function recordIterationStart(session: Session, iteration: number): Session {
	const now = Date.now();
	const existingTiming = session.statistics.iterationTimings.find(
		(timing) => timing.iteration === iteration,
	);

	let updatedTimings: IterationTiming[];

	if (existingTiming) {
		updatedTimings = session.statistics.iterationTimings.map((timing) =>
			timing.iteration === iteration ? { ...timing, startTime: now } : timing,
		);
	} else {
		updatedTimings = [
			...session.statistics.iterationTimings,
			{
				iteration,
				startTime: now,
				endTime: null,
				durationMs: null,
			},
		];
	}

	return {
		...session,
		lastUpdateTime: now,
		statistics: {
			...session.statistics,
			iterationTimings: updatedTimings,
		},
	};
}

export function recordIterationEnd(
	session: Session,
	iteration: number,
	wasSuccessful: boolean,
): Session {
	const now = Date.now();
	const existingTiming = session.statistics.iterationTimings.find(
		(timing) => timing.iteration === iteration,
	);

	let updatedTimings: IterationTiming[];
	let durationMs = 0;

	if (existingTiming) {
		durationMs = now - existingTiming.startTime;
		updatedTimings = session.statistics.iterationTimings.map((timing) =>
			timing.iteration === iteration ? { ...timing, endTime: now, durationMs } : timing,
		);
	} else {
		updatedTimings = [
			...session.statistics.iterationTimings,
			{
				iteration,
				startTime: now,
				endTime: now,
				durationMs: 0,
			},
		];
	}

	const completedIterations = session.statistics.completedIterations + 1;
	const successfulIterations = wasSuccessful
		? session.statistics.successfulIterations + 1
		: session.statistics.successfulIterations;
	const failedIterations = wasSuccessful
		? session.statistics.failedIterations
		: session.statistics.failedIterations + 1;
	const totalDurationMs = session.statistics.totalDurationMs + durationMs;
	const averageDurationMs = completedIterations > 0 ? totalDurationMs / completedIterations : 0;
	const successRate =
		completedIterations > 0 ? (successfulIterations / completedIterations) * 100 : 0;

	return {
		...session,
		lastUpdateTime: now,
		statistics: {
			...session.statistics,
			completedIterations,
			successfulIterations,
			failedIterations,
			totalDurationMs,
			averageDurationMs,
			successRate,
			iterationTimings: updatedTimings,
		},
	};
}

export function updateSessionIteration(
	session: Session,
	currentIteration: number,
	currentTaskIndex: number,
	elapsedTimeSeconds: number,
): Session {
	return {
		...session,
		lastUpdateTime: Date.now(),
		currentIteration,
		currentTaskIndex,
		elapsedTimeSeconds,
	};
}

export function updateSessionStatus(session: Session, status: SessionStatus): Session {
	return {
		...session,
		lastUpdateTime: Date.now(),
		status,
	};
}

export function isSessionResumable(session: Session | null): boolean {
	if (!session) {
		return false;
	}

	return (
		session.status === "running" || session.status === "paused" || session.status === "stopped"
	);
}
