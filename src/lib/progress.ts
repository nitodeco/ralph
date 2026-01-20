import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, RALPH_DIR } from "./paths.ts";

export const PROGRESS_FILE_PATH = `${RALPH_DIR}/progress.txt`;

export function initializeProgressFile(): void {
	ensureRalphDirExists();
	if (!existsSync(PROGRESS_FILE_PATH)) {
		writeFileSync(PROGRESS_FILE_PATH, "");
	}
}

export function readProgressFile(): string | null {
	if (!existsSync(PROGRESS_FILE_PATH)) {
		return null;
	}
	try {
		return readFileSync(PROGRESS_FILE_PATH, "utf-8");
	} catch {
		return null;
	}
}

export function appendProgress(content: string): void {
	ensureRalphDirExists();
	appendFileSync(PROGRESS_FILE_PATH, `${content}\n`);
}
