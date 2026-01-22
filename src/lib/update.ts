import { spawn } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { match } from "ts-pattern";
import { loadConfig, saveConfig } from "./config.ts";
import {
	getDefaultInstallDir,
	isDirectoryWritable,
	LOCAL_BIN_DIR,
	needsMigration,
	prependToShellConfig,
	SYSTEM_BIN_DIR,
} from "./paths.ts";

const REPO = "nitodeco/ralph";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface GitHubRelease {
	tag_name: string;
}

export interface MigrationResult {
	migrated: boolean;
	oldPath: string | null;
	newPath: string;
	shellConfigPath: string | null;
}

export function getArchitecture(): string {
	const arch = process.arch;

	return match(arch)
		.with("x64", () => "x64")
		.with("arm64", () => "arm64")
		.otherwise(() => {
			throw new Error(`Unsupported architecture: ${arch}`);
		});
}

export function getOperatingSystem(): string {
	const platform = process.platform;

	return match(platform)
		.with("darwin", () => "darwin")
		.with("linux", () => "linux")
		.otherwise(() => {
			throw new Error(`Unsupported OS: ${platform}. Ralph currently supports macOS and Linux.`);
		});
}

export async function fetchLatestVersion(): Promise<string> {
	const response = await fetch(GITHUB_API_URL);

	if (!response.ok) {
		throw new Error(`Failed to fetch latest version: ${response.statusText}`);
	}

	const releaseInfo = (await response.json()) as GitHubRelease;

	return releaseInfo.tag_name;
}

export function compareVersions(current: string, latest: string): number {
	const normalizedCurrent = current.replace(/^v/, "");
	const normalizedLatest = latest.replace(/^v/, "");

	const currentParts = normalizedCurrent.split(".").map(Number);
	const latestParts = normalizedLatest.split(".").map(Number);

	for (
		let versionPartIndex = 0;
		versionPartIndex < Math.max(currentParts.length, latestParts.length);
		versionPartIndex++
	) {
		const currentPart = currentParts.at(versionPartIndex) ?? 0;
		const latestPart = latestParts.at(versionPartIndex) ?? 0;

		if (latestPart > currentPart) {
			return 1;
		}

		if (latestPart < currentPart) {
			return -1;
		}
	}

	return 0;
}

export function getBinaryPath(): string {
	const binaryPath = process.execPath;

	if (binaryPath.includes("bun")) {
		const installDir = getDefaultInstallDir();

		return `${installDir}/ralph`;
	}

	return binaryPath;
}

export function getTargetInstallPath(): {
	targetPath: string;
	requiresMigration: boolean;
	currentPath: string;
} {
	const currentPath = getBinaryPath();
	const requiresMigration = needsMigration(currentPath);

	if (requiresMigration) {
		return {
			targetPath: join(LOCAL_BIN_DIR, "ralph"),
			requiresMigration: true,
			currentPath,
		};
	}

	return {
		targetPath: currentPath,
		requiresMigration: false,
		currentPath,
	};
}

export async function downloadBinary(
	version: string,
	operatingSystem: string,
	architecture: string,
	onProgress?: (downloaded: number, total: number) => void,
): Promise<ArrayBuffer> {
	const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/ralph-${operatingSystem}-${architecture}`;

	const response = await fetch(downloadUrl);

	if (!response.ok) {
		throw new Error(`Failed to download binary: ${response.statusText}`);
	}

	const contentLength = response.headers.get("Content-Length");
	const totalBytes = contentLength ? Number.parseInt(contentLength, 10) : 0;

	if (!response.body || !totalBytes || !onProgress) {
		return response.arrayBuffer();
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let downloadedBytes = 0;

	while (true) {
		const { done, value } = await reader.read();

		if (done) {
			break;
		}

		chunks.push(value);
		downloadedBytes += value.length;
		onProgress(downloadedBytes, totalBytes);
	}

	const binaryBuffer = new Uint8Array(downloadedBytes);
	let offset = 0;

	for (const chunk of chunks) {
		binaryBuffer.set(chunk, offset);
		offset += chunk.length;
	}

	return binaryBuffer.buffer;
}

export async function installBinary(binaryData: ArrayBuffer, targetPath: string): Promise<void> {
	const tempPath = `/tmp/ralph-update-${Date.now()}`;

	await Bun.write(tempPath, binaryData);

	const chmodProcess = Bun.spawn(["chmod", "+x", tempPath]);

	await chmodProcess.exited;

	const targetDirectory = targetPath.substring(0, targetPath.lastIndexOf("/"));

	if (!existsSync(targetDirectory)) {
		mkdirSync(targetDirectory, { recursive: true });
	}

	if (!isDirectoryWritable(targetDirectory)) {
		throw new Error(
			`Cannot write to ${targetDirectory}. Please set RALPH_INSTALL_DIR to a writable directory or ensure ~/.local/bin exists.`,
		);
	}

	if (existsSync(targetPath)) {
		unlinkSync(targetPath);
	}

	const mvProcess = Bun.spawn(["mv", tempPath, targetPath]);

	await mvProcess.exited;
}

export async function installWithMigration(binaryData: ArrayBuffer): Promise<MigrationResult> {
	const { targetPath, requiresMigration, currentPath } = getTargetInstallPath();

	await installBinary(binaryData, targetPath);

	let shellConfigPath: string | null = null;

	if (requiresMigration) {
		shellConfigPath = prependToShellConfig();
	}

	return {
		migrated: requiresMigration,
		oldPath: requiresMigration ? currentPath : null,
		newPath: targetPath,
		shellConfigPath,
	};
}

export function getRemoveOldBinaryCommand(oldPath: string): string {
	if (oldPath.startsWith(SYSTEM_BIN_DIR)) {
		return `sudo rm ${oldPath}`;
	}

	return `rm ${oldPath}`;
}

export function shouldCheckForUpdates(): boolean {
	const config = loadConfig();
	const lastCheck = config.lastUpdateCheck ?? 0;
	const now = Date.now();

	return now - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
}

export function isVersionSkipped(version: string): boolean {
	const config = loadConfig();

	return config.skipVersion === version;
}

export interface UpdateCheckResult {
	updateAvailable: boolean;
	latestVersion: string | null;
	error: string | null;
}

export async function checkForUpdateOnStartup(currentVersion: string): Promise<UpdateCheckResult> {
	if (!shouldCheckForUpdates()) {
		return { updateAvailable: false, latestVersion: null, error: null };
	}

	try {
		const latestVersion = await fetchLatestVersion();

		const config = loadConfig();

		config.lastUpdateCheck = Date.now();
		saveConfig(config);

		if (isVersionSkipped(latestVersion)) {
			return { updateAvailable: false, latestVersion: null, error: null };
		}

		const comparison = compareVersions(currentVersion, latestVersion);
		const updateAvailable = comparison > 0;

		return {
			updateAvailable,
			latestVersion: updateAvailable ? latestVersion : null,
			error: null,
		};
	} catch (_error) {
		return {
			updateAvailable: false,
			latestVersion: null,
			error: null,
		};
	}
}

export function restartApplication(newBinaryPath?: string): void {
	const binaryPath = newBinaryPath || getBinaryPath();
	const args = process.argv.slice(2).filter((arg) => arg !== "update");

	spawn(binaryPath, args, {
		detached: true,
		stdio: "inherit",
	}).unref();

	process.exit(0);
}
