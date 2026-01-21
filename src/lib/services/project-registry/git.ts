import { execSync } from "node:child_process";
import { isGitRepository } from "@/lib/paths.ts";

export function getGitRemoteUrl(cwd: string = process.cwd()): string | null {
	if (!isGitRepository(cwd)) {
		return null;
	}

	try {
		const result = execSync("git remote get-url origin", {
			cwd,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		const trimmed = result.trim();

		if (trimmed.length === 0) {
			return null;
		}

		return trimmed;
	} catch {
		return null;
	}
}
