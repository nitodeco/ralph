import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getGitRemoteUrl } from "./git.ts";
import {
	createGitProjectIdentifier,
	createPathProjectIdentifier,
	createProjectIdentifier,
} from "./resolution.ts";
import {
	type ProjectIdentifier,
	type ProjectMetadata,
	type ProjectRegistry,
	type ProjectRegistryConfig,
	type ProjectRegistryService,
	REGISTRY_VERSION,
	type RegisterProjectOptions,
} from "./types.ts";

function getDefaultConfig(): ProjectRegistryConfig {
	const globalDir = join(homedir(), ".ralph");

	return {
		globalDir,
		registryPath: join(globalDir, "registry.json"),
		projectsDir: join(globalDir, "projects"),
	};
}

function createEmptyRegistry(): ProjectRegistry {
	return {
		version: REGISTRY_VERSION,
		projects: {},
		pathCache: {},
	};
}

function isProjectRegistry(value: unknown): value is ProjectRegistry {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	return (
		typeof obj.version === "number" &&
		typeof obj.projects === "object" &&
		obj.projects !== null &&
		typeof obj.pathCache === "object" &&
		obj.pathCache !== null
	);
}

export function createProjectRegistryService(
	maybeConfig?: ProjectRegistryConfig,
): ProjectRegistryService {
	const config = maybeConfig ?? getDefaultConfig();

	function ensureGlobalDir(): void {
		if (!existsSync(config.globalDir)) {
			mkdirSync(config.globalDir, { recursive: true });
		}
	}

	function ensureProjectsDir(): void {
		ensureGlobalDir();

		if (!existsSync(config.projectsDir)) {
			mkdirSync(config.projectsDir, { recursive: true });
		}
	}

	function loadRegistry(): ProjectRegistry {
		ensureGlobalDir();

		if (!existsSync(config.registryPath)) {
			return createEmptyRegistry();
		}

		try {
			const content = readFileSync(config.registryPath, "utf-8");
			const parsed: unknown = JSON.parse(content);

			if (!isProjectRegistry(parsed)) {
				return createEmptyRegistry();
			}

			return parsed;
		} catch {
			return createEmptyRegistry();
		}
	}

	function saveRegistry(registry: ProjectRegistry): void {
		ensureGlobalDir();
		writeFileSync(config.registryPath, JSON.stringify(registry, null, "\t"));
	}

	function resolveCurrentProject(cwd: string = process.cwd()): ProjectIdentifier | null {
		const registry = loadRegistry();
		const cachedFolderName = registry.pathCache[cwd];

		if (cachedFolderName) {
			const maybeProject = registry.projects[cachedFolderName];

			if (maybeProject) {
				return maybeProject.identifier;
			}
		}

		const maybeGitRemote = getGitRemoteUrl(cwd);

		if (maybeGitRemote) {
			const gitIdentifier = createGitProjectIdentifier(maybeGitRemote);
			const maybeExistingProject = registry.projects[gitIdentifier.folderName];

			if (maybeExistingProject) {
				return maybeExistingProject.identifier;
			}
		}

		const pathIdentifier = createPathProjectIdentifier(cwd);
		const maybePathProject = registry.projects[pathIdentifier.folderName];

		if (maybePathProject) {
			return maybePathProject.identifier;
		}

		return null;
	}

	function registerProject(
		cwd: string = process.cwd(),
		options: RegisterProjectOptions = {},
	): ProjectIdentifier {
		ensureProjectsDir();

		let identifier: ProjectIdentifier;
		const maybeGitRemote = getGitRemoteUrl(cwd);

		if (options.customId) {
			identifier = createProjectIdentifier("custom", options.customId);
		} else if (maybeGitRemote) {
			identifier = createGitProjectIdentifier(maybeGitRemote);
		} else {
			identifier = createPathProjectIdentifier(cwd);
		}

		const projectDir = join(config.projectsDir, identifier.folderName);

		if (!existsSync(projectDir)) {
			mkdirSync(projectDir, { recursive: true });
		}

		const registry = loadRegistry();
		const now = Date.now();
		const existingProject = registry.projects[identifier.folderName];

		const metadata: ProjectMetadata = {
			identifier,
			displayName: options.displayName ?? existingProject?.displayName ?? identifier.folderName,
			createdAt: existingProject?.createdAt ?? now,
			lastAccessedAt: now,
			lastKnownPath: cwd,
			gitRemote: maybeGitRemote ?? undefined,
		};

		registry.projects[identifier.folderName] = metadata;
		registry.pathCache[cwd] = identifier.folderName;

		saveRegistry(registry);

		return identifier;
	}

	function getProjectDir(maybeIdentifier?: ProjectIdentifier): string | null {
		const identifier = maybeIdentifier ?? resolveCurrentProject();

		if (!identifier) {
			return null;
		}

		return join(config.projectsDir, identifier.folderName);
	}

	function getProjectFilePath(
		relativePath: string,
		maybeIdentifier?: ProjectIdentifier,
	): string | null {
		const projectDir = getProjectDir(maybeIdentifier);

		if (!projectDir) {
			return null;
		}

		return join(projectDir, relativePath);
	}

	function listProjects(): ProjectMetadata[] {
		const registry = loadRegistry();

		return Object.values(registry.projects).sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
	}

	function getProjectMetadata(identifier: ProjectIdentifier): ProjectMetadata | null {
		const registry = loadRegistry();

		return registry.projects[identifier.folderName] ?? null;
	}

	function updateLastAccessed(identifier: ProjectIdentifier): void {
		const registry = loadRegistry();
		const maybeProject = registry.projects[identifier.folderName];

		if (maybeProject) {
			maybeProject.lastAccessedAt = Date.now();
			saveRegistry(registry);
		}
	}

	function isProjectInitialized(cwd: string = process.cwd()): boolean {
		const maybeIdentifier = resolveCurrentProject(cwd);

		if (!maybeIdentifier) {
			return false;
		}

		const projectDir = getProjectDir(maybeIdentifier);

		if (!projectDir) {
			return false;
		}

		const prdPath = join(projectDir, "prd.json");

		return existsSync(prdPath);
	}

	function removeProject(identifier: ProjectIdentifier): boolean {
		const registry = loadRegistry();
		const maybeProject = registry.projects[identifier.folderName];

		if (!maybeProject) {
			return false;
		}

		delete registry.projects[identifier.folderName];

		const pathsToRemove = Object.entries(registry.pathCache)
			.filter(([, folderName]) => folderName === identifier.folderName)
			.map(([path]) => path);

		for (const path of pathsToRemove) {
			delete registry.pathCache[path];
		}

		saveRegistry(registry);

		return true;
	}

	function getRegistryPath(): string {
		return config.registryPath;
	}

	function getProjectsDir(): string {
		return config.projectsDir;
	}

	return {
		loadRegistry,
		saveRegistry,
		ensureProjectsDir,
		resolveCurrentProject,
		registerProject,
		getProjectDir,
		getProjectFilePath,
		listProjects,
		getProjectMetadata,
		updateLastAccessed,
		isProjectInitialized,
		removeProject,
		getRegistryPath,
		getProjectsDir,
	};
}
