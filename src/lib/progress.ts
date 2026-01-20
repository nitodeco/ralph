import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureRalphDirExists, PROGRESS_FILE_PATH } from "./paths.ts";

export { PROGRESS_FILE_PATH } from "./paths.ts";

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
