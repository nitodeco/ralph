import { accessSync, constants, existsSync, unlinkSync } from "node:fs";
import { select } from "@inquirer/prompts";
import { VERSION } from "../index.ts";
import { loadConfig, saveConfig } from "./config.ts";

const REPO = "nitodeco/ralph";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface GitHubRelease {
	tag_name: string;
}

export function getArchitecture(): string {
	const arch = process.arch;
	switch (arch) {
		case "x64":
			return "x64";
		case "arm64":
			return "arm64";
		default:
			throw new Error(`Unsupported architecture: ${arch}`);
	}
}

export function getOperatingSystem(): string {
	const platform = process.platform;
	switch (platform) {
		case "darwin":
			return "darwin";
		default:
			throw new Error(`Unsupported OS: ${platform}. Ralph currently only supports macOS.`);
	}
}

export async function fetchLatestVersion(): Promise<string> {
	const response = await fetch(GITHUB_API_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch latest version: ${response.statusText}`);
	}
	const data = (await response.json()) as GitHubRelease;
	return data.tag_name;
}

export function compareVersions(current: string, latest: string): number {
	const normalizedCurrent = current.replace(/^v/, "");
	const normalizedLatest = latest.replace(/^v/, "");

	const currentParts = normalizedCurrent.split(".").map(Number);
	const latestParts = normalizedLatest.split(".").map(Number);

	for (let index = 0; index < Math.max(currentParts.length, latestParts.length); index++) {
		const currentPart = currentParts[index] || 0;
		const latestPart = latestParts[index] || 0;

		if (latestPart > currentPart) return 1;
		if (latestPart < currentPart) return -1;
	}

	return 0;
}

export function getBinaryPath(): string {
	const binaryPath = process.execPath;
	if (binaryPath.includes("bun")) {
		return "/usr/local/bin/ralph";
	}
	return binaryPath;
}

export function hasWriteAccess(path: string): boolean {
	try {
		const directory = path.substring(0, path.lastIndexOf("/"));
		accessSync(directory, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

export async function downloadBinary(
	version: string,
	operatingSystem: string,
	architecture: string,
): Promise<ArrayBuffer> {
	const downloadUrl = `https://github.com/${REPO}/releases/download/${version}/ralph-${operatingSystem}-${architecture}`;
	console.log(`Downloading from: ${downloadUrl}`);

	const response = await fetch(downloadUrl);
	if (!response.ok) {
		throw new Error(`Failed to download binary: ${response.statusText}`);
	}

	return response.arrayBuffer();
}

export async function installBinary(binaryData: ArrayBuffer, targetPath: string): Promise<void> {
	const tempPath = `/tmp/ralph-update-${Date.now()}`;

	await Bun.write(tempPath, binaryData);

	const chmodProcess = Bun.spawn(["chmod", "+x", tempPath]);
	await chmodProcess.exited;

	if (hasWriteAccess(targetPath)) {
		if (existsSync(targetPath)) {
			unlinkSync(targetPath);
		}
		const mvProcess = Bun.spawn(["mv", tempPath, targetPath]);
		await mvProcess.exited;
	} else {
		console.log(`Requesting sudo access to install to ${targetPath}...`);
		const sudoProcess = Bun.spawn(["sudo", "mv", tempPath, targetPath], {
			stdin: "inherit",
			stdout: "inherit",
			stderr: "inherit",
		});
		const exitCode = await sudoProcess.exited;
		if (exitCode !== 0) {
			throw new Error("Failed to install binary with sudo");
		}
	}
}

export async function performUpdate(latestVersion: string): Promise<void> {
	const operatingSystem = getOperatingSystem();
	const architecture = getArchitecture();

	console.log(`Updating Ralph to ${latestVersion}...`);
	console.log("");

	const binaryData = await downloadBinary(latestVersion, operatingSystem, architecture);
	const targetPath = getBinaryPath();

	await installBinary(binaryData, targetPath);

	console.log("");
	console.log(`Ralph updated successfully to ${latestVersion}!`);
}

function shouldCheckForUpdates(): boolean {
	const config = loadConfig();
	const lastCheck = config.lastUpdateCheck ?? 0;
	const now = Date.now();

	return now - lastCheck >= UPDATE_CHECK_INTERVAL_MS;
}

function updateLastCheckTimestamp(): void {
	const config = loadConfig();
	config.lastUpdateCheck = Date.now();
	saveConfig(config);
}

function isVersionSkipped(version: string): boolean {
	const config = loadConfig();
	return config.skipVersion === version;
}

function skipVersion(version: string): void {
	const config = loadConfig();
	config.skipVersion = version;
	saveConfig(config);
}

function clearSkippedVersion(): void {
	const config = loadConfig();
	config.skipVersion = undefined;
	saveConfig(config);
}

type UpdateAction = "update" | "remind" | "skip";

async function promptForUpdate(latestVersion: string): Promise<UpdateAction> {
	console.log("");
	console.log(`A new version of Ralph is available: ${latestVersion} (current: ${VERSION})`);
	console.log("");

	const action = await select<UpdateAction>({
		message: "Would you like to update?",
		choices: [
			{ name: "Update now", value: "update" },
			{ name: "Remind me later", value: "remind" },
			{ name: "Skip this version", value: "skip" },
		],
	});

	return action;
}

export async function checkForUpdatesAndPrompt(): Promise<void> {
	if (!shouldCheckForUpdates()) {
		return;
	}

	try {
		const latestVersion = await fetchLatestVersion();
		updateLastCheckTimestamp();

		const comparison = compareVersions(VERSION, latestVersion);

		if (comparison <= 0) {
			clearSkippedVersion();
			return;
		}

		if (isVersionSkipped(latestVersion)) {
			return;
		}

		const action = await promptForUpdate(latestVersion);

		switch (action) {
			case "update":
				await performUpdate(latestVersion);
				process.exit(0);
				break;
			case "skip":
				skipVersion(latestVersion);
				console.log(`Skipping version ${latestVersion}. Run 'ralph update' to update manually.`);
				console.log("");
				break;
			case "remind":
				console.log("You can update later by running 'ralph update'.");
				console.log("");
				break;
		}
	} catch {
		// Silently ignore update check failures
	}
}
