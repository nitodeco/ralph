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
	const gitignoreContent = "ralph.log\nlogs/\n";

	if (!existsSync(gitignorePath)) {
		writeFileSync(gitignorePath, gitignoreContent, "utf-8");
	} else {
		const existingContent = readFileSync(gitignorePath, "utf-8");
		if (!existingContent.includes("logs/")) {
			writeFileSync(gitignorePath, `${existingContent.trimEnd()}\nlogs/\n`, "utf-8");
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
