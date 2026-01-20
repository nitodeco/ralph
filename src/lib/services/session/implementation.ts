import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_FILE_PATH } from "@/lib/paths.ts";
import type {
	IterationTiming,
	Session,
	SessionService,
	SessionStatistics,
	SessionStatus,
} from "./types.ts";
import { isSession } from "./validation.ts";

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

export function createSessionService(): SessionService {
	function load(): Session | null {
		if (!existsSync(SESSION_FILE_PATH)) {
			return null;
		}

		try {
			const content = readFileSync(SESSION_FILE_PATH, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isSession(parsed)) {
				return null;
			}

			if (!parsed.statistics) {
				parsed.statistics = createInitialStatistics(parsed.totalIterations);
				save(parsed);
			}

			return parsed;
		} catch {
			return null;
		}
	}

	function save(session: Session): void {
		ensureRalphDirExists();
		writeFileSync(SESSION_FILE_PATH, JSON.stringify(session, null, 2));
	}

	function deleteSession(): void {
		if (existsSync(SESSION_FILE_PATH)) {
			unlinkSync(SESSION_FILE_PATH);
		}
	}

	function exists(): boolean {
		return existsSync(SESSION_FILE_PATH);
	}

	function create(totalIterations: number, currentTaskIndex: number): Session {
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

	function recordIterationStart(session: Session, iteration: number): Session {
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

	function recordIterationEnd(
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

	function updateIteration(
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

	function updateStatus(session: Session, status: SessionStatus): Session {
		return {
			...session,
			lastUpdateTime: Date.now(),
			status,
		};
	}

	function isResumable(session: Session | null): boolean {
		if (!session) {
			return false;
		}

		return (
			session.status === "running" || session.status === "paused" || session.status === "stopped"
		);
	}

	return {
		load,
		save,
		delete: deleteSession,
		exists,
		create,
		recordIterationStart,
		recordIterationEnd,
		updateIteration,
		updateStatus,
		isResumable,
	};
}
