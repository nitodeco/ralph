import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, SESSION_FILE_PATH } from "@/lib/paths.ts";
import { createSessionService } from "@/lib/services/session/implementation.ts";
import type { Session, SessionStatus } from "@/types.ts";

const TEST_DIR = "/tmp/ralph-test-session";
const RALPH_DIR = `${TEST_DIR}/.ralph`;

describe("session functions", () => {
	let sessionService: ReturnType<typeof createSessionService>;

	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}

		mkdirSync(RALPH_DIR, { recursive: true });
		process.chdir(TEST_DIR);
		ensureRalphDirExists();
		sessionService = createSessionService();
	});

	afterEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true });
		}
	});

	describe("create", () => {
		test("creates session with correct initial state", () => {
			const session = sessionService.create(10, 0);

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
			const session = sessionService.create(5, 2);

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

	describe("save and load", () => {
		test("saves and loads session correctly", () => {
			const originalSession = sessionService.create(10, 0);

			sessionService.save(originalSession);
			expect(sessionService.exists()).toBe(true);

			const loadedSession = sessionService.load();

			expect(loadedSession).not.toBeNull();
			expect(loadedSession?.totalIterations).toBe(10);
			expect(loadedSession?.currentIteration).toBe(0);
			expect(loadedSession?.status).toBe("running");
		});

		test("load returns null when file does not exist", () => {
			expect(sessionService.exists()).toBe(false);
			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});

		test("load returns null for session without statistics", () => {
			const session = sessionService.create(5, 0);

			delete (session as Partial<Session>).statistics;
			sessionService.save(session);

			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});

		test("load handles corrupted JSON gracefully", () => {
			ensureRalphDirExists();
			writeFileSync(SESSION_FILE_PATH, "{ invalid json }");

			const loaded = sessionService.load();

			expect(loaded).toBeNull();
		});
	});

	describe("delete", () => {
		test("deletes session file when it exists", () => {
			const session = sessionService.create(10, 0);

			sessionService.save(session);
			expect(sessionService.exists()).toBe(true);

			sessionService.delete();
			expect(sessionService.exists()).toBe(false);
		});

		test("does not throw when session file does not exist", () => {
			expect(() => sessionService.delete()).not.toThrow();
		});
	});

	describe("exists", () => {
		test("returns false when session file does not exist", () => {
			expect(sessionService.exists()).toBe(false);
		});

		test("returns true when session file exists", () => {
			const session = sessionService.create(10, 0);

			sessionService.save(session);
			expect(sessionService.exists()).toBe(true);
		});
	});

	describe("recordIterationStart", () => {
		test("creates new timing entry for iteration", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.recordIterationStart(session, 1);

			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.iteration).toBe(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThan(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeNull();
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeNull();
		});

		test("updates existing timing entry if iteration already exists", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const updated = sessionService.recordIterationStart(withStart, 1);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.startTime).toBeGreaterThanOrEqual(
				withStart.statistics.iterationTimings[0]?.startTime ?? 0,
			);
		});

		test("adds multiple iteration timings", () => {
			const session = sessionService.create(10, 0);
			const iter1 = sessionService.recordIterationStart(session, 1);
			const iter2 = sessionService.recordIterationStart(iter1, 2);

			expect(iter2.statistics.iterationTimings).toHaveLength(2);
		});
	});

	describe("recordIterationEnd", () => {
		test("completes iteration timing and updates statistics", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const startTime = withStart.statistics.iterationTimings[0]?.startTime ?? 0;

			const updated = sessionService.recordIterationEnd(withStart, 1, true);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(1);
			expect(updated.statistics.failedIterations).toBe(0);
			expect(updated.statistics.iterationTimings[0]?.endTime).toBeGreaterThanOrEqual(startTime);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBeGreaterThanOrEqual(0);
			expect(updated.statistics.successRate).toBe(100);
		});

		test("records failed iteration correctly", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);

			const updated = sessionService.recordIterationEnd(withStart, 1, false);

			expect(updated.statistics.completedIterations).toBe(1);
			expect(updated.statistics.successfulIterations).toBe(0);
			expect(updated.statistics.failedIterations).toBe(1);
			expect(updated.statistics.successRate).toBe(0);
		});

		test("calculates average duration correctly", () => {
			const session = sessionService.create(10, 0);
			const iter1 = sessionService.recordIterationStart(session, 1);
			const iter1End = sessionService.recordIterationEnd(iter1, 1, true);
			const iter2 = sessionService.recordIterationStart(iter1End, 2);
			const iter2End = sessionService.recordIterationEnd(iter2, 2, true);

			expect(iter2End.statistics.completedIterations).toBe(2);
			expect(iter2End.statistics.averageDurationMs).toBeGreaterThanOrEqual(0);
			expect(iter2End.statistics.totalDurationMs).toBeGreaterThanOrEqual(0);
		});

		test("creates timing entry if iteration start was not recorded", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.recordIterationEnd(session, 1, true);

			expect(updated.statistics.iterationTimings).toHaveLength(1);
			expect(updated.statistics.iterationTimings[0]?.durationMs).toBe(0);
		});

		test("updates existing timing entry", () => {
			const session = sessionService.create(10, 0);
			const withStart = sessionService.recordIterationStart(session, 1);
			const firstEnd = sessionService.recordIterationEnd(withStart, 1, true);
			const secondEnd = sessionService.recordIterationEnd(firstEnd, 1, false);

			expect(secondEnd.statistics.iterationTimings).toHaveLength(1);
			expect(secondEnd.statistics.failedIterations).toBe(1);
		});
	});

	describe("updateIteration", () => {
		test("updates iteration and task index", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateIteration(session, 5, 3, 120);

			expect(updated.currentIteration).toBe(5);
			expect(updated.currentTaskIndex).toBe(3);
			expect(updated.elapsedTimeSeconds).toBe(120);
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateIteration(session, 2, 1, 60);

			expect(updated.totalIterations).toBe(10);
			expect(updated.status).toBe("running");
			expect(updated.startTime).toBe(session.startTime);
		});
	});

	describe("updateStatus", () => {
		test("updates status correctly", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateStatus(session, "paused");

			expect(updated.status).toBe("paused");
			expect(updated.lastUpdateTime).toBeGreaterThanOrEqual(session.lastUpdateTime);
		});

		test("preserves other session fields", () => {
			const session = sessionService.create(10, 0);
			const updated = sessionService.updateStatus(session, "stopped");

			expect(updated.totalIterations).toBe(10);
			expect(updated.currentIteration).toBe(0);
			expect(updated.startTime).toBe(session.startTime);
		});

		test("handles all status types", () => {
			const session = sessionService.create(10, 0);
			const statuses: SessionStatus[] = ["running", "paused", "stopped", "completed"];

			for (const status of statuses) {
				const updated = sessionService.updateStatus(session, status);

				expect(updated.status).toBe(status);
			}
		});
	});

	describe("isResumable", () => {
		test("returns false for null session", () => {
			expect(sessionService.isResumable(null)).toBe(false);
		});

		test("returns true for running status", () => {
			const session = sessionService.create(10, 0);

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns true for paused status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "paused");

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns true for stopped status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "stopped");

			expect(sessionService.isResumable(session)).toBe(true);
		});

		test("returns false for completed status", () => {
			const session = sessionService.updateStatus(sessionService.create(10, 0), "completed");

			expect(sessionService.isResumable(session)).toBe(false);
		});
	});
});
