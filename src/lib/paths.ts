import {
	accessSync,
	appendFileSync,
	constants,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getProjectRegistryService, isInitialized } from "./services/container.ts";

export const LOCAL_RALPH_DIR = ".ralph";
export const GLOBAL_RALPH_DIR = join(homedir(), ".ralph");
export const REGISTRY_PATH = join(GLOBAL_RALPH_DIR, "registry.json");
export const PROJECTS_DIR = join(GLOBAL_RALPH_DIR, "projects");
export const GLOBAL_CONFIG_PATH = join(GLOBAL_RALPH_DIR, "config.json");
export const LOCAL_BIN_DIR = join(homedir(), ".local", "bin");
export const SYSTEM_BIN_DIR = "/usr/local/bin";

function getProjectFilePath(relativePath: string): string {
	if (!isInitialized()) {
		return join(LOCAL_RALPH_DIR, relativePath);
	}

	const projectRegistryService = getProjectRegistryService();
	const maybePath = projectRegistryService.getProjectFilePath(relativePath);

	if (maybePath === null) {
		return join(LOCAL_RALPH_DIR, relativePath);
	}

	return maybePath;
}

export function getSessionFilePath(): string {
	return getProjectFilePath("session.json");
}

export function getPrdJsonPath(): string {
	return getProjectFilePath("prd.json");
}

export function getProgressFilePath(): string {
	return getProjectFilePath("progress.txt");
}

export function getInstructionsFilePath(): string {
	return getProjectFilePath("instructions.md");
}

export function getProjectConfigPath(): string {
	return getProjectFilePath("config.json");
}

export function getGuardrailsFilePath(): string {
	return getProjectFilePath("guardrails.json");
}

export function getFailureHistoryFilePath(): string {
	return getProjectFilePath("failure-history.json");
}

export function getSessionMemoryFilePath(): string {
	return getProjectFilePath("session-memory.json");
}

export function getLogsDir(): string {
	return getProjectFilePath("logs");
}

export function getArchiveDir(): string {
	return getProjectFilePath("archive");
}

export function isDirectoryWritable(directory: string): boolean {
	try {
		accessSync(directory, constants.W_OK);

		return true;
	} catch {
		return false;
	}
}

export function isDirectoryInPath(directory: string): boolean {
	const pathEnv = process.env.PATH || "";
	const paths = pathEnv.split(":");

	return paths.includes(directory);
}

export function needsMigration(currentBinaryPath: string): boolean {
	return currentBinaryPath.startsWith(SYSTEM_BIN_DIR) && !isDirectoryWritable(SYSTEM_BIN_DIR);
}

export function getShellConfigPath(): string | null {
	const shell = process.env.SHELL || "";
	const shellName = shell.split("/").pop() || "";
	const home = homedir();

	switch (shellName) {
		case "zsh":
			return join(home, ".zshrc");
		case "bash":
			if (existsSync(join(home, ".bash_profile"))) {
				return join(home, ".bash_profile");
			}

			return join(home, ".bashrc");
		default:
			return null;
	}
}

export function prependToShellConfig(): string | null {
	const configPath = getShellConfigPath();

	if (!configPath) {
		return null;
	}

	const exportLine = `export PATH="${LOCAL_BIN_DIR}:$PATH"`;
	const markerComment = "# Added by Ralph CLI";
	const fullEntry = `\n${markerComment}\n${exportLine}\n`;

	if (existsSync(configPath)) {
		const content = readFileSync(configPath, "utf-8");

		if (content.includes(exportLine) || content.includes(markerComment)) {
			return configPath;
		}
	}

	appendFileSync(configPath, fullEntry, "utf-8");

	return configPath;
}

export function getDefaultInstallDir(): string {
	const envOverride = process.env.RALPH_INSTALL_DIR;

	if (envOverride) {
		return envOverride;
	}

	return LOCAL_BIN_DIR;
}

export function ensureProjectDirExists(): void {
	if (!isInitialized()) {
		if (!existsSync(LOCAL_RALPH_DIR)) {
			mkdirSync(LOCAL_RALPH_DIR, { recursive: true });
		}

		return;
	}

	const projectRegistryService = getProjectRegistryService();
	const maybeProjectDir = projectRegistryService.getProjectDir();

	if (maybeProjectDir === null) {
		throw new Error("Project is not initialized. Run 'ralph init' first.");
	}

	if (!existsSync(maybeProjectDir)) {
		mkdirSync(maybeProjectDir, { recursive: true });
	}
}

export function ensureGlobalRalphDirExists(): void {
	if (!existsSync(GLOBAL_RALPH_DIR)) {
		mkdirSync(GLOBAL_RALPH_DIR, { recursive: true });
	}
}

export function ensureLogsDirExists(): void {
	const logsDir = getLogsDir();

	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true });
	}
}

export function isGitRepository(directory: string = process.cwd()): boolean {
	const gitDir = join(directory, ".git");

	return existsSync(gitDir);
}

/**
 * @deprecated Use LOCAL_RALPH_DIR instead. Will be removed in a future version.
 */
export const RALPH_DIR = LOCAL_RALPH_DIR;

/**
 * @deprecated Use getLogsDir() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const LOGS_DIR = join(LOCAL_RALPH_DIR, "logs");

/**
 * @deprecated Use getSessionFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const SESSION_FILE_PATH = join(LOCAL_RALPH_DIR, "session.json");

/**
 * @deprecated Use getPrdJsonPath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const PRD_JSON_PATH = join(LOCAL_RALPH_DIR, "prd.json");

/**
 * @deprecated Use getProgressFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const PROGRESS_FILE_PATH = join(LOCAL_RALPH_DIR, "progress.txt");

/**
 * @deprecated Use getInstructionsFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const INSTRUCTIONS_FILE_PATH = join(LOCAL_RALPH_DIR, "instructions.md");

/**
 * @deprecated Use getProjectConfigPath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const PROJECT_CONFIG_PATH = join(LOCAL_RALPH_DIR, "config.json");

/**
 * @deprecated Use getGuardrailsFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const GUARDRAILS_FILE_PATH = join(LOCAL_RALPH_DIR, "guardrails.json");

/**
 * @deprecated Use getFailureHistoryFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const FAILURE_HISTORY_FILE_PATH = join(LOCAL_RALPH_DIR, "failure-history.json");

/**
 * @deprecated Use getSessionMemoryFilePath() instead. Will be removed in a future version.
 * This constant is kept for backward compatibility but returns the local path.
 */
export const SESSION_MEMORY_FILE_PATH = join(LOCAL_RALPH_DIR, "session-memory.json");

/**
 * @deprecated Use ensureProjectDirExists() instead. Will be removed in a future version.
 * This function creates the local .ralph directory for backward compatibility.
 */
export function ensureRalphDirExists(): void {
	if (!existsSync(LOCAL_RALPH_DIR)) {
		mkdirSync(LOCAL_RALPH_DIR, { recursive: true });
	}

	const gitignorePath = join(LOCAL_RALPH_DIR, ".gitignore");
	const gitignoreContent = "ralph.log\nlogs/\narchive/\n";

	if (existsSync(gitignorePath)) {
		const content = readFileSync(gitignorePath, "utf-8");
		let updatedContent = content;

		if (!content.includes("logs/")) {
			updatedContent = `${updatedContent.trimEnd()}\nlogs/\n`;
		}

		if (!content.includes("archive/")) {
			updatedContent = `${updatedContent.trimEnd()}\narchive/\n`;
		}

		if (updatedContent !== content) {
			writeFileSync(gitignorePath, updatedContent, "utf-8");
		}
	} else {
		writeFileSync(gitignorePath, gitignoreContent, "utf-8");
	}
}
