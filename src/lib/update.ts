import { accessSync, constants, existsSync, unlinkSync } from "node:fs";
import { loadConfig } from "./config.ts";

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

	const result = new Uint8Array(downloadedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}

	return result.buffer;
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
