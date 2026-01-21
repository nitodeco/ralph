import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureProjectDirExists, getProgressFilePath } from "./paths.ts";

export { getProgressFilePath } from "./paths.ts";

export function initializeProgressFile(): void {
	ensureProjectDirExists();
	const progressFilePath = getProgressFilePath();

	if (!existsSync(progressFilePath)) {
		writeFileSync(progressFilePath, "");
	}
}

export function readProgressFile(): string | null {
	const progressFilePath = getProgressFilePath();

	if (!existsSync(progressFilePath)) {
		return null;
	}

	try {
		return readFileSync(progressFilePath, "utf-8");
	} catch {
		return null;
	}
}

export function appendProgress(content: string): void {
	ensureProjectDirExists();
	appendFileSync(getProgressFilePath(), `${content}\n`);
}
