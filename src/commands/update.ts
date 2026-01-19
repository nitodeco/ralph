import { accessSync, constants, existsSync, unlinkSync } from "node:fs";
import { VERSION } from "../index.ts";

const REPO = "nitodeco/ralph";
const GITHUB_API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

interface GitHubRelease {
	tag_name: string;
}

function getArchitecture(): string {
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

function getOperatingSystem(): string {
	const platform = process.platform;
	switch (platform) {
		case "darwin":
			return "darwin";
		default:
			throw new Error(`Unsupported OS: ${platform}. Ralph currently only supports macOS.`);
	}
}

async function fetchLatestVersion(): Promise<string> {
	const response = await fetch(GITHUB_API_URL);
	if (!response.ok) {
		throw new Error(`Failed to fetch latest version: ${response.statusText}`);
	}
	const data = (await response.json()) as GitHubRelease;
	return data.tag_name;
}

function compareVersions(current: string, latest: string): number {
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

function getBinaryPath(): string {
	const binaryPath = process.execPath;
	if (binaryPath.includes("bun")) {
		return "/usr/local/bin/ralph";
	}
	return binaryPath;
}

function hasWriteAccess(path: string): boolean {
	try {
		const directory = path.substring(0, path.lastIndexOf("/"));
		accessSync(directory, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

async function downloadBinary(
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

async function installBinary(binaryData: ArrayBuffer, targetPath: string): Promise<void> {
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

export async function updateCommand(): Promise<void> {
	console.log("Checking for updates...");
	console.log("");

	try {
		const operatingSystem = getOperatingSystem();
		const architecture = getArchitecture();
		const latestVersion = await fetchLatestVersion();
		const currentVersion = VERSION;

		console.log(`  Current version: ${currentVersion}`);
		console.log(`  Latest version:  ${latestVersion}`);
		console.log("");

		const comparison = compareVersions(currentVersion, latestVersion);

		if (comparison <= 0) {
			console.log("Ralph is already up to date.");
			return;
		}

		console.log(`Updating Ralph to ${latestVersion}...`);
		console.log("");

		const binaryData = await downloadBinary(latestVersion, operatingSystem, architecture);
		const targetPath = getBinaryPath();

		await installBinary(binaryData, targetPath);

		console.log("");
		console.log(`Ralph updated successfully to ${latestVersion}!`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${errorMessage}`);
		process.exit(1);
	}
}
