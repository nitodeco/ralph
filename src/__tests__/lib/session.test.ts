import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_FILE_PATH } from "@/lib/paths.ts";
import {
	createSession,
	deleteSession,
	isSessionResumable,
	loadSession,
	recordIterationEnd,
	recordIterationStart,
	saveSession,
	sessionExists,
	updateSessionIteration,
	updateSessionStatus,
} from "@/lib/session.ts";
import type { Session, SessionStatus } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-session";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("session functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("createSession", () => {
		test("creates session with correct initial state", () => {
			const session = createSession(10, 0);

			expect(session.totalIterations).toBe(10);
			expect(session.currentIteration).toBe(0);
			expect(session.currentTaskIndex).toBe(0);
			expect(session.status).toBe("running");
			expect(session.elapsedTimeSeconds).toBe(0);
			expect(session.startTime).toBeGreaterThan(0);
			expect(session.lastUpdateTime).toBeGreaterThanOrEqual(session.startTime);
			expect(session.statistics).toBeDefined();
			expect(session.statistics.totalIterations).toBe(10);
			expect(session.statistics.completedIterations).toBe(0);
		});

		test("initializes statistics correctly", () => {
			const session = createSession(5, 2);

			expect(session.statistics.totalIterations).toBe(5);
			expect(session.statistics.completedIterations).toBe(0);
			expect(session.statistics.successfulIterations).toBe(0);
			expect(session.statistics.failedIterations).toBe(0);
			expect(session.statistics.totalDurationMs).toBe(0);
			expect(session.statistics.averageDurationMs).toBe(0);
			expect(session.statistics.successRate).toBe(0);
			expect(session.statistics.iterationTimings).toEqual([]);
		});
	});

	describe("saveSession and loadSession", () => {
		test("saves and loads session correctly", () => {
			const originalSession = createSession(10, 0);

			saveSession(originalSession);
			expect(sessionExists()).toBe(true);

			const loadedSession = loadSession();

			expect(loadedSession).not.toBeNull();
			expect(loadedSession?.totalIterations).toBe(10);
			expect(loadedSession?.currentIteration).toBe(0);
			expect(loadedSession?.status).toBe("running");
		});

		test("loadSession returns null when file does not exist", () => {
			expect(sessionExists()).toBe(false);
			const loaded = loadSession();

			expect(loaded).toBeNull();
		});

		test("loadSession returns null for session without statistics", () => {
			const session = createSession(5, 0);

			delete (session as Partial<Session>).statistics;
			saveSession(session);

			const loaded = loadSession();

			expect(loaded).toBeNull();
		});

		test("loadSession handles corrupted JSON gracefully", () => {
			ensureRalphDirExists();
			writeFileSync(SESSION_FILE_PATH, "{ invalid json }");

			const loaded = loadSession();

			expect(loaded).toBeNull();
		});
	});

	describe("deleteSession", () => {
		test("deletes session file when it exists", () => {
			const session = createSession(10, 0);

			saveSession(session);
			expect(sessionExists()).toBe(true);

			deleteSession();
			expect(sessionExists()).toBe(false);
		});

		test("does not throw when session file does not exist", () => {
			expect(() => deleteSession()).not.toThrow();
		});
	});

	describe("sessionExists", () => {
		test("returns false when session file does not exist", () => {
			expect(sessionExists()).toBe(false);
		});

		test("returns true when session file exists", () => {
			const session = createSession(10, 0);

			saveSession(session);
			expect(sessionExists()).toBe(true);
		});
	});

	describe("recordIterationStart", () => {
		test("creates new timing entry for iteration", () => {
			const session = createSession(10, 0);
			const updated = recordIterationStart(session, 1);

			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.iteration).toBe(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThan(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeNull();
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeNull();
		});

		test("updates existing timing entry if iteration already exists", () => {
			const session = createSession(10, 0);
			const withStart = recordIterationStart(session, 1);
			const updated = recordIterationStart(withStart, 1);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThanOrEqual(
				withStart.statistics.iterationTimings[0]?.startTime ?? 0,
			);
		});

		test("adds multiple iteration timings", () => {
			const session = createSession(10, 0);
			const iter1 = recordIterationStart(session, 1);
			const iter2 = recordIterationStart(iter1, 2);

			expect(iter2.statistics.iterationTimings).toHaveLength(2);
		});
	});

	describe("recordIterationEnd", () => {
		test("completes iteration timing and updates statistics", () => {
			const session = createSession(10, 0);
			const withStart = recordIterationStart(session, 1);
			const startTime = withStart.statistics.iterationTimings[0]?.startTime ?? 0;

			const updated = recordIterationEnd(withStart, 1, true);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(1);
			expect(updated.statistics.failedIterations).toBe(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeGreaterThanOrEqual(startTime);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeGreaterThanOrEqual(0);
			expect(updated.statistics.successRate).toBe(100);
		});

		test("records failed iteration correctly", () => {
			const session = createSession(10, 0);
			const withStart = recordIterationStart(session, 1);

			const updated = recordIterationEnd(withStart, 1, false);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(0);
			expect(updated.statistics.failedIterations).toBe(1);
			expect(updated.statistics.successRate).toBe(0);
		});

		test("calculates average duration correctly", () => {
			const session = createSession(10, 0);
			const iter1 = recordIterationStart(session, 1);
			const iter1End = recordIterationEnd(iter1, 1, true);
			const iter2 = recordIterationStart(iter1End, 2);
			const iter2End = recordIterationEnd(iter2, 2, true);

			expect(iter2End.statistics.completedIterations).toBe(2);
			expect(iter2End.statistics.averageDurationMs).toBeGreaterThanOrEqual(0);
			expect(iter2End.statistics.totalDurationMs).toBeGreaterThanOrEqual(0);
		});

		test("creates timing entry if iteration start was not recorded", () => {
			const session = createSession(10, 0);
			const updated = recordIterationEnd(session, 1, true);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBe(0);
		});

		test("updates existing timing entry", () => {
			const session = createSession(10, 0);
			const withStart = recordIterationStart(session, 1);
			const firstEnd = recordIterationEnd(withStart, 1, true);
			const secondEnd = recordIterationEnd(firstEnd, 1, false);

			expect(secondEnd.statistics.iterationTimings).toHaveLength(1);
			expect(secondEnd.statistics.failedIterations).toBe(1);
		});
	});

	describe("updateSessionIteration", () => {
		test("updates iteration and task index", () => {
			const session = createSession(10, 0);
			const updated = updateSessionIteration(session, 5, 3, 120);

			expect(updated.currentIteration).toBe(5);
			expect(updated.currentTaskIndex).toBe(3);
			expect(updated.elapsedTimeSeconds).toBe(120);
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = createSession(10, 0);
			const updated = updateSessionIteration(session, 2, 1, 60);

			expect(updated.totalIterations).toBe(10);
			expect(updated.status).toBe("running");
			expect(updated.startTime).toBe(session.startTime);
		});
	});

	describe("updateSessionStatus", () => {
		test("updates status correctly", () => {
			const session = createSession(10, 0);
			const updated = updateSessionStatus(session, "paused");

			expect(updated.status).toBe("paused");
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = createSession(10, 0);
			const updated = updateSessionStatus(session, "stopped");

			expect(updated.totalIterations).toBe(10);
			expect(updated.currentIteration).toBe(0);
			expect(updated.startTime).toBe(session.startTime);
		});

		test("handles all status types", () => {
			const session = createSession(10, 0);
			const statuses: SessionStatus[] = ["running", "paused", "stopped", "completed"];

			for (const status of statuses) {
				const updated = updateSessionStatus(session, status);

				expect(updated.status).toBe(status);
			}
		});
	});

	describe("isSessionResumable", () => {
		test("returns false for null session", () => {
			expect(isSessionResumable(null)).toBe(false);
		});

		test("returns true for running status", () => {
			const session = createSession(10, 0);

			expect(isSessionResumable(session)).toBe(true);
		});

		test("returns true for paused status", () => {
			const session = updateSessionStatus(createSession(10, 0), "paused");

			expect(isSessionResumable(session)).toBe(true);
		});

		test("returns true for stopped status", () => {
			const session = updateSessionStatus(createSession(10, 0), "stopped");

			expect(isSessionResumable(session)).toBe(true);
		});

		test("returns false for completed status", () => {
			const session = updateSessionStatus(createSession(10, 0), "completed");

			expect(isSessionResumable(session)).toBe(false);
		});
	});
});
