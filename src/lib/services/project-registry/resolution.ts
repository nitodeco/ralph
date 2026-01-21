import { createHash } from "node:crypto";
import type { ProjectIdentifier, ProjectIdType } from "./types.ts";

export function normalizeGitRemote(url: string): string {
	let normalized = url.trim();

	normalized = normalized.replace(/^(https?:\/\/|git:\/\/|ssh:\/\/)/, "");

	normalized = normalized.replace(/^git@/, "");

	normalized = normalized.replace(/\.git$/, "");

	normalized = normalized.replace(/:(?!\d)/, "/");

	return normalized;
}

export function hashPath(absolutePath: string): string {
	const hash = createHash("sha256").update(absolutePath).digest("hex");

	return hash.slice(0, 12);
}

export function sanitizeFolderName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_.-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();
}

export function buildFolderName(type: ProjectIdType, normalizedValue: string): string {
	const sanitized = sanitizeFolderName(normalizedValue);
	const prefix = type === "git" ? "git" : type === "path" ? "path" : "custom";

	return `${prefix}--${sanitized}`;
}

export function createProjectIdentifier(type: ProjectIdType, value: string): ProjectIdentifier {
	const normalizedValue = type === "git" ? normalizeGitRemote(value) : value;
	const folderName = buildFolderName(type, normalizedValue);

	return {
		type,
		value: normalizedValue,
		folderName,
	};
}

export function createGitProjectIdentifier(remoteUrl: string): ProjectIdentifier {
	return createProjectIdentifier("git", remoteUrl);
}

export function createPathProjectIdentifier(absolutePath: string): ProjectIdentifier {
	const hashedPath = hashPath(absolutePath);

	return createProjectIdentifier("path", hashedPath);
}
