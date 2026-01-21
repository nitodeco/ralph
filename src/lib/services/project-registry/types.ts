export type ProjectIdType = "git" | "path" | "custom";

export interface ProjectIdentifier {
	type: ProjectIdType;
	value: string;
	folderName: string;
}

export interface ProjectMetadata {
	identifier: ProjectIdentifier;
	displayName: string;
	createdAt: number;
	lastAccessedAt: number;
	lastKnownPath: string;
	gitRemote?: string;
}

export interface ProjectRegistry {
	version: number;
	projects: Record<string, ProjectMetadata>;
	pathCache: Record<string, string>;
}

export const REGISTRY_VERSION = 1;
