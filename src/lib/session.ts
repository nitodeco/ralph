import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import type { Session, SessionStatus } from "@/types.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./paths.ts";

const SESSION_FILE_PATH = `${RALPH_DIR}/session.json`;

export function loadSession(): Session | null {
	if (!existsSync(SESSION_FILE_PATH)) {
		return null;
	}

	try {
		const content = readFileSync(SESSION_FILE_PATH, "utf-8");
		return JSON.parse(content) as Session;
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
	if (!session) return false;
	return session.status === "running" || session.status === "paused";
}
