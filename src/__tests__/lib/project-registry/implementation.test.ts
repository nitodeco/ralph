import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";
import { REGISTRY_VERSION } from "@/lib/services/project-registry/types.ts";

const TEST_HOME_DIR = join(tmpdir(), `ralph-test-${Date.now()}`);
const TEST_RALPH_DIR = join(TEST_HOME_DIR, ".ralph");
const TEST_REGISTRY_PATH = join(TEST_RALPH_DIR, "registry.json");
const TEST_PROJECTS_DIR = join(TEST_RALPH_DIR, "projects");

function getTestConfig(): ProjectRegistryConfig {
	return {
		globalDir: TEST_RALPH_DIR,
		registryPath: TEST_REGISTRY_PATH,
		projectsDir: TEST_PROJECTS_DIR,
	};
}

describe("ProjectRegistryService", () => {
	beforeEach(() => {
		if (existsSync(TEST_HOME_DIR)) {
			rmSync(TEST_HOME_DIR, { recursive: true, force: true });
		}

		mkdirSync(TEST_HOME_DIR, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TEST_HOME_DIR)) {
			rmSync(TEST_HOME_DIR, { recursive: true, force: true });
		}
	});

	describe("loadRegistry", () => {
		test("returns empty registry when no file exists", () => {
			const service = createProjectRegistryService(getTestConfig());

			const registry = service.loadRegistry();

			expect(registry.version).toBe(REGISTRY_VERSION);
			expect(registry.projects).toEqual({});
			expect(registry.pathCache).toEqual({});
		});

		test("loads existing registry file", () => {
			mkdirSync(TEST_RALPH_DIR, { recursive: true });
			const existingRegistry = {
				version: REGISTRY_VERSION,
				projects: {
					"git--github.com-user-repo": {
						identifier: {
							type: "git",
							value: "github.com/user/repo",
							folderName: "git--github.com-user-repo",
						},
						displayName: "Test Project",
						createdAt: 1000,
						lastAccessedAt: 2000,
						lastKnownPath: "/some/path",
					},
				},
				pathCache: {
					"/some/path": "git--github.com-user-repo",
				},
			};

			writeFileSync(TEST_REGISTRY_PATH, JSON.stringify(existingRegistry));

			const service = createProjectRegistryService(getTestConfig());
			const registry = service.loadRegistry();

			expect(registry.version).toBe(REGISTRY_VERSION);
			expect(Object.keys(registry.projects)).toHaveLength(1);

			const maybeProject = registry.projects["git--github.com-user-repo"];

			expect(maybeProject?.displayName).toBe("Test Project");
		});

		test("returns empty registry when file is invalid JSON", () => {
			mkdirSync(TEST_RALPH_DIR, { recursive: true });
			writeFileSync(TEST_REGISTRY_PATH, "not valid json");

			const service = createProjectRegistryService(getTestConfig());
			const registry = service.loadRegistry();

			expect(registry.version).toBe(REGISTRY_VERSION);
			expect(registry.projects).toEqual({});
		});

		test("returns empty registry when file has invalid structure", () => {
			mkdirSync(TEST_RALPH_DIR, { recursive: true });
			writeFileSync(TEST_REGISTRY_PATH, JSON.stringify({ invalid: "structure" }));

			const service = createProjectRegistryService(getTestConfig());
			const registry = service.loadRegistry();

			expect(registry.version).toBe(REGISTRY_VERSION);
			expect(registry.projects).toEqual({});
		});
	});

	describe("saveRegistry", () => {
		test("creates directory and saves registry", () => {
			const service = createProjectRegistryService(getTestConfig());
			const registry = {
				version: REGISTRY_VERSION,
				projects: {},
				pathCache: {},
			};

			service.saveRegistry(registry);

			expect(existsSync(TEST_REGISTRY_PATH)).toBe(true);
		});

		test("saves registry with projects", () => {
			const service = createProjectRegistryService(getTestConfig());
			const registry = {
				version: REGISTRY_VERSION,
				projects: {
					"test-folder": {
						identifier: {
							type: "path" as const,
							value: "abc123",
							folderName: "test-folder",
						},
						displayName: "Test",
						createdAt: Date.now(),
						lastAccessedAt: Date.now(),
						lastKnownPath: "/test/path",
					},
				},
				pathCache: {
					"/test/path": "test-folder",
				},
			};

			service.saveRegistry(registry);

			const loadedRegistry = service.loadRegistry();

			expect(loadedRegistry.projects["test-folder"]?.displayName).toBe("Test");
			expect(loadedRegistry.pathCache["/test/path"]).toBe("test-folder");
		});
	});

	describe("ensureProjectsDir", () => {
		test("creates projects directory", () => {
			const service = createProjectRegistryService(getTestConfig());

			service.ensureProjectsDir();

			expect(existsSync(TEST_PROJECTS_DIR)).toBe(true);
		});

		test("does not throw if directory already exists", () => {
			mkdirSync(TEST_PROJECTS_DIR, { recursive: true });
			const service = createProjectRegistryService(getTestConfig());

			expect(() => service.ensureProjectsDir()).not.toThrow();
		});
	});

	describe("registerProject", () => {
		test("registers a project with path-based identifier when no git remote", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			expect(identifier.type).toBe("path");
			expect(identifier.folderName).toMatch(/^path--[a-f0-9]+$/);

			const projectDir = join(TEST_PROJECTS_DIR, identifier.folderName);

			expect(existsSync(projectDir)).toBe(true);

			const registry = service.loadRegistry();

			expect(registry.projects[identifier.folderName]).toBeDefined();
			expect(registry.pathCache[testProjectDir]).toBe(identifier.folderName);
		});

		test("registers a project with custom displayName", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir, {
				displayName: "My Custom Project",
			});

			const registry = service.loadRegistry();

			expect(registry.projects[identifier.folderName]?.displayName).toBe("My Custom Project");
		});

		test("registers a project with custom ID", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir, {
				customId: "my-custom-id",
			});

			expect(identifier.type).toBe("custom");
			expect(identifier.value).toBe("my-custom-id");
			expect(identifier.folderName).toBe("custom--my-custom-id");
		});

		test("updates lastAccessedAt when re-registering existing project", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier1 = service.registerProject(testProjectDir);

			const registry1 = service.loadRegistry();
			const firstAccessTime = registry1.projects[identifier1.folderName]?.lastAccessedAt ?? 0;

			const identifier2 = service.registerProject(testProjectDir);

			const registry2 = service.loadRegistry();
			const secondAccessTime = registry2.projects[identifier2.folderName]?.lastAccessedAt ?? 0;

			expect(identifier1.folderName).toBe(identifier2.folderName);
			expect(secondAccessTime).toBeGreaterThanOrEqual(firstAccessTime);
		});
	});

	describe("resolveCurrentProject", () => {
		test("returns null when project is not registered", () => {
			const service = createProjectRegistryService(getTestConfig());

			const result = service.resolveCurrentProject("/nonexistent/path");

			expect(result).toBeNull();
		});

		test("returns identifier from pathCache when available", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const registeredIdentifier = service.registerProject(testProjectDir);

			const resolvedIdentifier = service.resolveCurrentProject(testProjectDir);

			expect(resolvedIdentifier).not.toBeNull();
			expect(resolvedIdentifier?.folderName).toBe(registeredIdentifier.folderName);
		});

		test("returns identifier by path hash when path not in cache but project exists", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const registeredIdentifier = service.registerProject(testProjectDir);

			const registry = service.loadRegistry();

			delete registry.pathCache[testProjectDir];
			service.saveRegistry(registry);

			const resolvedIdentifier = service.resolveCurrentProject(testProjectDir);

			expect(resolvedIdentifier).not.toBeNull();
			expect(resolvedIdentifier?.folderName).toBe(registeredIdentifier.folderName);
		});
	});

	describe("getProjectDir", () => {
		test("returns null when no project is registered for current directory", () => {
			const service = createProjectRegistryService(getTestConfig());

			const result = service.getProjectDir();

			expect(result).toBeNull();
		});

		test("returns project directory path when identifier is provided", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const projectDir = service.getProjectDir(identifier);

			expect(projectDir).toBe(join(TEST_PROJECTS_DIR, identifier.folderName));
		});
	});

	describe("getProjectFilePath", () => {
		test("returns null when no project is registered", () => {
			const service = createProjectRegistryService(getTestConfig());

			const result = service.getProjectFilePath("prd.json");

			expect(result).toBeNull();
		});

		test("returns file path within project directory", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const filePath = service.getProjectFilePath("prd.json", identifier);

			expect(filePath).toBe(join(TEST_PROJECTS_DIR, identifier.folderName, "prd.json"));
		});

		test("handles nested paths", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const filePath = service.getProjectFilePath("logs/session.log", identifier);

			expect(filePath).toBe(join(TEST_PROJECTS_DIR, identifier.folderName, "logs/session.log"));
		});
	});

	describe("listProjects", () => {
		test("returns empty array when no projects registered", () => {
			const service = createProjectRegistryService(getTestConfig());

			const projects = service.listProjects();

			expect(projects).toEqual([]);
		});

		test("returns all registered projects", () => {
			const service = createProjectRegistryService(getTestConfig());

			const dir1 = join(TEST_HOME_DIR, "project1");
			const dir2 = join(TEST_HOME_DIR, "project2");

			mkdirSync(dir1, { recursive: true });
			mkdirSync(dir2, { recursive: true });

			service.registerProject(dir1, { displayName: "Project 1" });
			service.registerProject(dir2, { displayName: "Project 2" });

			const projects = service.listProjects();

			expect(projects).toHaveLength(2);

			const names = projects.map((p) => p.displayName);

			expect(names).toContain("Project 1");
			expect(names).toContain("Project 2");
		});

		test("returns projects sorted by lastAccessedAt descending", () => {
			const service = createProjectRegistryService(getTestConfig());

			const dir1 = join(TEST_HOME_DIR, "project1");
			const dir2 = join(TEST_HOME_DIR, "project2");

			mkdirSync(dir1, { recursive: true });
			mkdirSync(dir2, { recursive: true });

			const id1 = service.registerProject(dir1, { displayName: "First" });

			service.registerProject(dir2, { displayName: "Second" });

			service.updateLastAccessed(id1);

			const projects = service.listProjects();

			expect(projects.at(0)?.displayName).toBe("First");
			expect(projects.at(1)?.displayName).toBe("Second");
		});
	});

	describe("getProjectMetadata", () => {
		test("returns null for non-existent project", () => {
			const service = createProjectRegistryService(getTestConfig());
			const fakeIdentifier = {
				type: "path" as const,
				value: "abc123",
				folderName: "path--abc123",
			};

			const metadata = service.getProjectMetadata(fakeIdentifier);

			expect(metadata).toBeNull();
		});

		test("returns metadata for registered project", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir, {
				displayName: "Test Project",
			});

			const metadata = service.getProjectMetadata(identifier);

			expect(metadata).not.toBeNull();
			expect(metadata?.displayName).toBe("Test Project");
			expect(metadata?.lastKnownPath).toBe(testProjectDir);
		});
	});

	describe("updateLastAccessed", () => {
		test("updates lastAccessedAt timestamp", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const metadata1 = service.getProjectMetadata(identifier);
			const firstAccess = metadata1?.lastAccessedAt ?? 0;

			service.updateLastAccessed(identifier);

			const metadata2 = service.getProjectMetadata(identifier);
			const secondAccess = metadata2?.lastAccessedAt ?? 0;

			expect(secondAccess).toBeGreaterThanOrEqual(firstAccess);
		});

		test("does nothing for non-existent project", () => {
			const service = createProjectRegistryService(getTestConfig());
			const fakeIdentifier = {
				type: "path" as const,
				value: "abc123",
				folderName: "path--abc123",
			};

			expect(() => service.updateLastAccessed(fakeIdentifier)).not.toThrow();
		});
	});

	describe("isProjectInitialized", () => {
		test("returns false when project is not registered", () => {
			const service = createProjectRegistryService(getTestConfig());

			const result = service.isProjectInitialized("/nonexistent/path");

			expect(result).toBe(false);
		});

		test("returns false when project is registered but has no prd.json", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());

			service.registerProject(testProjectDir);

			const result = service.isProjectInitialized(testProjectDir);

			expect(result).toBe(false);
		});

		test("returns true when project is registered and has prd.json", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const projectDir = service.getProjectDir(identifier);

			if (projectDir) {
				writeFileSync(join(projectDir, "prd.json"), JSON.stringify({ project: "Test", tasks: [] }));
			}

			const result = service.isProjectInitialized(testProjectDir);

			expect(result).toBe(true);
		});
	});

	describe("removeProject", () => {
		test("returns false when project does not exist", () => {
			const service = createProjectRegistryService(getTestConfig());
			const fakeIdentifier = {
				type: "path" as const,
				value: "abc123",
				folderName: "path--abc123",
			};

			const result = service.removeProject(fakeIdentifier);

			expect(result).toBe(false);
		});

		test("removes project from registry and pathCache", () => {
			const testProjectDir = join(TEST_HOME_DIR, "test-project");

			mkdirSync(testProjectDir, { recursive: true });

			const service = createProjectRegistryService(getTestConfig());
			const identifier = service.registerProject(testProjectDir);

			const result = service.removeProject(identifier);

			expect(result).toBe(true);

			const registry = service.loadRegistry();

			expect(registry.projects[identifier.folderName]).toBeUndefined();
			expect(registry.pathCache[testProjectDir]).toBeUndefined();
		});
	});

	describe("getRegistryPath", () => {
		test("returns the registry file path", () => {
			const service = createProjectRegistryService(getTestConfig());

			const path = service.getRegistryPath();

			expect(path).toBe(TEST_REGISTRY_PATH);
		});
	});

	describe("getProjectsDir", () => {
		test("returns the projects directory path", () => {
			const service = createProjectRegistryService(getTestConfig());

			const path = service.getProjectsDir();

			expect(path).toBe(TEST_PROJECTS_DIR);
		});
	});
});
