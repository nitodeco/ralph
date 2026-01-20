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

export const RALPH_DIR = ".ralph";
export const LOGS_DIR = join(RALPH_DIR, "logs");
export const GLOBAL_RALPH_DIR = join(homedir(), ".ralph");
export const LOCAL_BIN_DIR = join(homedir(), ".local", "bin");
export const SYSTEM_BIN_DIR = "/usr/local/bin";

export const PROGRESS_FILE_PATH = join(RALPH_DIR, "progress.txt");
export const SESSION_FILE_PATH = join(RALPH_DIR, "session.json");
export const INSTRUCTIONS_FILE_PATH = join(RALPH_DIR, "instructions.md");
export const PRD_JSON_PATH = join(RALPH_DIR, "prd.json");
export const PRD_YAML_PATH = join(RALPH_DIR, "prd.yaml");
export const GLOBAL_CONFIG_PATH = join(GLOBAL_RALPH_DIR, "config.json");
export const PROJECT_CONFIG_PATH = join(RALPH_DIR, "config.json");
export const GUARDRAILS_FILE_PATH = join(RALPH_DIR, "guardrails.json");
export const FAILURE_HISTORY_FILE_PATH = join(RALPH_DIR, "failure-history.json");
export const SESSION_MEMORY_FILE_PATH = join(RALPH_DIR, "session-memory.json");

export const PATHS = {
	ralphDir: RALPH_DIR,
	logsDir: LOGS_DIR,
	globalRalphDir: GLOBAL_RALPH_DIR,
	localBinDir: LOCAL_BIN_DIR,
	systemBinDir: SYSTEM_BIN_DIR,
	progressFile: PROGRESS_FILE_PATH,
	sessionFile: SESSION_FILE_PATH,
	instructionsFile: INSTRUCTIONS_FILE_PATH,
	prdJson: PRD_JSON_PATH,
	prdYaml: PRD_YAML_PATH,
	globalConfig: GLOBAL_CONFIG_PATH,
	projectConfig: PROJECT_CONFIG_PATH,
	guardrails: GUARDRAILS_FILE_PATH,
	failureHistory: FAILURE_HISTORY_FILE_PATH,
	sessionMemory: SESSION_MEMORY_FILE_PATH,
} as const;

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

export function ensureRalphDirExists(): void {
	if (!existsSync(RALPH_DIR)) {
		mkdirSync(RALPH_DIR, { recursive: true });
	}
	const gitignorePath = join(RALPH_DIR, ".gitignore");
	const gitignoreContent = "ralph.log\nlogs/\narchive/\n";

	if (!existsSync(gitignorePath)) {
		writeFileSync(gitignorePath, gitignoreContent, "utf-8");
	} else {
		const existingContent = readFileSync(gitignorePath, "utf-8");
		let updatedContent = existingContent;
		if (!existingContent.includes("logs/")) {
			updatedContent = `${updatedContent.trimEnd()}\nlogs/\n`;
		}
		if (!existingContent.includes("archive/")) {
			updatedContent = `${updatedContent.trimEnd()}\narchive/\n`;
		}
		if (updatedContent !== existingContent) {
			writeFileSync(gitignorePath, updatedContent, "utf-8");
		}
	}
}

export function ensureGlobalRalphDirExists(): void {
	if (!existsSync(GLOBAL_RALPH_DIR)) {
		mkdirSync(GLOBAL_RALPH_DIR, { recursive: true });
	}
}

export function ensureLogsDirExists(): void {
	ensureRalphDirExists();
	if (!existsSync(LOGS_DIR)) {
		mkdirSync(LOGS_DIR, { recursive: true });
	}
}
