import { execSync } from "node:child_process";
import { isGitRepository } from "@/lib/paths.ts";

export interface GitDiffStats {
	filesModified: number;
	filesCreated: number;
	filesDeleted: number;
}

const EMPTY_STATS: GitDiffStats = {
	filesModified: 0,
	filesCreated: 0,
	filesDeleted: 0,
};

export function getGitStatusStats(cwd: string = process.cwd()): GitDiffStats {
	if (!isGitRepository(cwd)) {
		return EMPTY_STATS;
	}

	try {
		const result = execSync("git status --porcelain", {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		const trimmed = result.trim();

		if (trimmed.length === 0) {
			return EMPTY_STATS;
		}

		const lines = trimmed.split("\n");

		const stats: GitDiffStats = {
			filesModified: 0,
			filesCreated: 0,
			filesDeleted: 0,
		};

		for (const line of lines) {
			const statusCode = line.slice(0, 2);

			if (statusCode.includes("A") || statusCode === "??") {
				stats.filesCreated += 1;
			} else if (statusCode.includes("D")) {
				stats.filesDeleted += 1;
			} else if (statusCode.includes("M") || statusCode.includes("R") || statusCode.includes("C")) {
				stats.filesModified += 1;
			}
		}

		return stats;
	} catch {
		return EMPTY_STATS;
	}
}
