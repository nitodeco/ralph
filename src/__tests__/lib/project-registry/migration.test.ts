import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import {
	hasLocalRalphDir,
	migrateLocalRalphDir,
	removeLocalRalphDir,
} from "@/lib/services/project-registry/migration.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";

const TEST_DIR = join(tmpdir(), `ralph-migration-test-${Date.now()}`);
const TEST_RALPH_DIR = join(TEST_DIR, "global-ralph");
const TEST_PROJECTS_DIR = join(TEST_RALPH_DIR, "projects");
const TEST_PROJECT_DIR = join(TEST_DIR, "my-project");
const TEST_LOCAL_RALPH = join(TEST_PROJECT_DIR, ".ralph");

function getTestConfig(): ProjectRegistryConfig {
	return {
		globalDir: TEST_RALPH_DIR,
		registryPath: join(TEST_RALPH_DIR, "registry.json"),
		projectsDir: TEST_PROJECTS_DIR,
	};
}

const ORIGINAL_CWD = process.cwd();

describe("migration functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}

		mkdirSync(TEST_RALPH_DIR, { recursive: true });
		mkdirSync(TEST_PROJECT_DIR, { recursive: true });
	});

	afterEach(() => {
		try {
			process.chdir(ORIGINAL_CWD);
		} catch {
			// Ignore
		}

		teardownTestServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("hasLocalRalphDir", () => {
		test("returns false when no local .ralph exists", () => {
			expect(hasLocalRalphDir(TEST_PROJECT_DIR)).toBe(false);
		});

		test("returns true when local .ralph exists", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });

			expect(hasLocalRalphDir(TEST_PROJECT_DIR)).toBe(true);
		});
	});

	describe("removeLocalRalphDir", () => {
		test("returns false when no local .ralph exists", () => {
			expect(removeLocalRalphDir(TEST_PROJECT_DIR)).toBe(false);
		});

		test("removes local .ralph directory", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(join(TEST_LOCAL_RALPH, "test.txt"), "test");

			expect(removeLocalRalphDir(TEST_PROJECT_DIR)).toBe(true);
			expect(existsSync(TEST_LOCAL_RALPH)).toBe(false);
		});
	});

	describe("migrateLocalRalphDir", () => {
		test("returns error when services not initialized", () => {
			const result = migrateLocalRalphDir(TEST_PROJECT_DIR);

			expect(result.migrated).toBe(false);
			expect(result.error).toBe("Services not initialized");
		});

		test("returns without migration when no local .ralph exists", () => {
			const projectRegistryService = createProjectRegistryService(getTestConfig());

			bootstrapTestServices({ projectRegistry: projectRegistryService });

			const result = migrateLocalRalphDir(TEST_PROJECT_DIR);

			expect(result.migrated).toBe(false);
			expect(result.filesMigrated).toEqual([]);
			expect(result.error).toBeUndefined();
		});

		test("migrates files from local to global", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(
				join(TEST_LOCAL_RALPH, "prd.json"),
				JSON.stringify({ project: "Test", tasks: [] }),
			);
			writeFileSync(join(TEST_LOCAL_RALPH, "config.json"), JSON.stringify({ agent: "cursor" }));

			const projectRegistryService = createProjectRegistryService(getTestConfig());

			bootstrapTestServices({ projectRegistry: projectRegistryService });
			process.chdir(TEST_PROJECT_DIR);

			const result = migrateLocalRalphDir();

			expect(result.migrated).toBe(true);
			expect(result.filesMigrated).toContain("prd.json");
			expect(result.filesMigrated).toContain("config.json");

			expect(existsSync(TEST_LOCAL_RALPH)).toBe(false);

			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				expect(existsSync(join(globalProjectDir, "prd.json"))).toBe(true);
				expect(existsSync(join(globalProjectDir, "config.json"))).toBe(true);

				const prd = JSON.parse(readFileSync(join(globalProjectDir, "prd.json"), "utf-8"));

				expect(prd.project).toBe("Test");
			}
		});

		test("migrates logs directory", () => {
			mkdirSync(join(TEST_LOCAL_RALPH, "logs"), { recursive: true });
			writeFileSync(join(TEST_LOCAL_RALPH, "logs", "iteration-1.log"), "log content");

			const projectRegistryService = createProjectRegistryService(getTestConfig());

			bootstrapTestServices({ projectRegistry: projectRegistryService });
			process.chdir(TEST_PROJECT_DIR);

			const result = migrateLocalRalphDir();

			expect(result.migrated).toBe(true);
			expect(result.filesMigrated).toContain("logs/iteration-1.log");

			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				expect(existsSync(join(globalProjectDir, "logs", "iteration-1.log"))).toBe(true);
			}
		});

		test("does not overwrite existing files in global directory", () => {
			mkdirSync(TEST_LOCAL_RALPH, { recursive: true });
			writeFileSync(
				join(TEST_LOCAL_RALPH, "prd.json"),
				JSON.stringify({ project: "Local", tasks: [] }),
			);

			const projectRegistryService = createProjectRegistryService(getTestConfig());

			bootstrapTestServices({ projectRegistry: projectRegistryService });
			process.chdir(TEST_PROJECT_DIR);

			projectRegistryService.registerProject();
			const globalProjectDir = projectRegistryService.getProjectDir();

			expect(globalProjectDir).not.toBeNull();

			if (globalProjectDir) {
				mkdirSync(globalProjectDir, { recursive: true });
				writeFileSync(
					join(globalProjectDir, "prd.json"),
					JSON.stringify({ project: "Global", tasks: [] }),
				);

				const result = migrateLocalRalphDir();

				expect(result.migrated).toBe(true);
				expect(result.filesMigrated).not.toContain("prd.json");

				const prd = JSON.parse(readFileSync(join(globalProjectDir, "prd.json"), "utf-8"));

				expect(prd.project).toBe("Global");
			}
		});
	});
});
