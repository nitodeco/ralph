import {
	accessSync,
	appendFileSync,
	constants,
	existsSync,
	mkdirSync,
	readFileSync,
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
		return join(GLOBAL_RALPH_DIR, "default", relativePath);
	}

	const projectRegistryService = getProjectRegistryService();
	const maybePath = projectRegistryService.getProjectFilePath(relativePath);

	if (maybePath === null) {
		projectRegistryService.registerProject();
		const newPath = projectRegistryService.getProjectFilePath(relativePath);

		if (newPath === null) {
			return join(GLOBAL_RALPH_DIR, "default", relativePath);
		}

		return newPath;
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

export function getCommandHistoryFilePath(): string {
	return getProjectFilePath("command-history.json");
}

export function getRulesFilePath(): string {
	return getProjectFilePath("rules.json");
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
		const defaultDir = join(GLOBAL_RALPH_DIR, "default");

		if (!existsSync(defaultDir)) {
			mkdirSync(defaultDir, { recursive: true });
		}

		return;
	}

	const projectRegistryService = getProjectRegistryService();
	let maybeProjectDir = projectRegistryService.getProjectDir();

	if (maybeProjectDir === null) {
		projectRegistryService.registerProject();
		maybeProjectDir = projectRegistryService.getProjectDir();
	}

	if (maybeProjectDir === null) {
		const defaultDir = join(GLOBAL_RALPH_DIR, "default");

		if (!existsSync(defaultDir)) {
			mkdirSync(defaultDir, { recursive: true });
		}

		return;
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
