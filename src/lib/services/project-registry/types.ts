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

export interface RegisterProjectOptions {
	displayName?: string;
	customId?: string;
}

export interface ProjectRegistryConfig {
	globalDir: string;
	registryPath: string;
	projectsDir: string;
}

export interface ProjectRegistryService {
	loadRegistry(): ProjectRegistry;
	saveRegistry(registry: ProjectRegistry): void;
	ensureProjectsDir(): void;
	resolveCurrentProject(cwd?: string): ProjectIdentifier | null;
	registerProject(cwd?: string, options?: RegisterProjectOptions): ProjectIdentifier;
	getProjectDir(identifier?: ProjectIdentifier): string | null;
	getProjectFilePath(relativePath: string, identifier?: ProjectIdentifier): string | null;
	listProjects(): ProjectMetadata[];
	getProjectMetadata(identifier: ProjectIdentifier): ProjectMetadata | null;
	updateLastAccessed(identifier: ProjectIdentifier): void;
	isProjectInitialized(cwd?: string): boolean;
	removeProject(identifier: ProjectIdentifier): boolean;
	getRegistryPath(): string;
	getProjectsDir(): string;
}
