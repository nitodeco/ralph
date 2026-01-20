import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const RALPH_DIR = ".ralph";
export const GLOBAL_RALPH_DIR = join(homedir(), ".ralph");

export function ensureRalphDirExists(): void {
	if (!existsSync(RALPH_DIR)) {
		mkdirSync(RALPH_DIR, { recursive: true });
	}
	const gitignorePath = join(RALPH_DIR, ".gitignore");

	if (!existsSync(gitignorePath)) {
		writeFileSync(gitignorePath, "ralph.log\n", "utf-8");
	}
}

export function ensureGlobalRalphDirExists(): void {
	if (!existsSync(GLOBAL_RALPH_DIR)) {
		mkdirSync(GLOBAL_RALPH_DIR, { recursive: true });
	}
}
