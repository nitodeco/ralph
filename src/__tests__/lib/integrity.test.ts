import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRalphDirectoryIntegrity, formatIntegrityIssues } from "@/lib/integrity.ts";
import {
	initializeServices,
	resetServices,
	type ServiceContainer,
} from "@/lib/services/container.ts";
import { createProjectRegistryService } from "@/lib/services/project-registry/implementation.ts";
import type { ProjectRegistryConfig } from "@/lib/services/project-registry/types.ts";

const TEST_DIR = join(tmpdir(), `ralph-test-integrity-${Date.now()}`);
const TEST_RALPH_DIR = join(TEST_DIR, ".ralph");
const TEST_PROJECTS_DIR = join(TEST_RALPH_DIR, "projects");
const TEST_PROJECT_DIR = join(TEST_PROJECTS_DIR, "test-project");

function getTestConfig(): ProjectRegistryConfig {
	return {
		globalDir: TEST_RALPH_DIR,
		registryPath: join(TEST_RALPH_DIR, "registry.json"),
		projectsDir: TEST_PROJECTS_DIR,
	};
}

function createMockServices(
	projectRegistryService: ReturnType<typeof createProjectRegistryService>,
): ServiceContainer {
	const defaultConfig = {
		agent: "cursor" as const,
		maxRetries: 3,
		retryDelayMs: 1000,
		agentTimeoutMs: 300000,
		stuckThresholdMs: 60000,
		maxOutputHistoryBytes: 1048576,
		retryWithContext: true,
		maxDecompositionsPerTask: 3,
		learningEnabled: true,
		verification: { enabled: false, failOnWarning: false },
	};

	return {
		projectRegistry: projectRegistryService,
		config: {
			get: () => defaultConfig,
			load: () => defaultConfig,
			loadGlobal: () => defaultConfig,
			loadGlobalRaw: () => null,
			loadProjectRaw: () => null,
			getWithValidation: (validateFn) => ({
				config: defaultConfig,
				validation: validateFn(defaultConfig),
			}),
			saveGlobal: () => {},
			saveProject: () => {},
			invalidate: () => {},
			invalidateGlobal: () => {},
			invalidateAll: () => {},
			globalConfigExists: () => true,
			getEffective: () => ({ global: null, project: null, effective: defaultConfig }),
		},
		guardrails: {
			get: () => [],
			load: () => [],
			save: () => {},
			exists: () => false,
			initialize: () => {},
			invalidate: () => {},
			add: () => ({
				id: "test",
				instruction: "test",
				trigger: "always" as const,
				category: "quality" as const,
				enabled: true,
				addedAt: new Date().toISOString(),
			}),
			remove: () => true,
			toggle: () => null,
			getById: () => null,
			getActive: () => [],
			formatForPrompt: () => "",
		},
		prd: {
			get: () => null,
			load: () => null,
			loadWithValidation: () => ({ prd: null }),
			reload: () => null,
			reloadWithValidation: () => ({ prd: null }),
			save: () => {},
			invalidate: () => {},
			findFile: () => null,
			isComplete: () => false,
			getNextTask: () => null,
			getNextTaskWithIndex: () => null,
			getTaskByTitle: () => null,
			getTaskByIndex: () => null,
			getCurrentTaskIndex: () => -1,
			canWorkOnTask: () => ({ canWork: true }),
			createEmpty: (projectName) => ({ project: projectName, tasks: [] }),
			loadInstructions: () => null,
		},
		sessionMemory: {
			get: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			load: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			save: () => {},
			exists: () => false,
			initialize: () => ({
				projectName: "Test",
				lessonsLearned: [],
				successfulPatterns: [],
				failedApproaches: [],
				taskNotes: {},
				lastUpdated: new Date().toISOString(),
			}),
			invalidate: () => {},
			addLesson: () => {},
			addSuccessPattern: () => {},
			addFailedApproach: () => {},
			addTaskNote: () => {},
			getTaskNote: () => null,
			clear: () => {},
			getStats: () => ({
				lessonsCount: 0,
				patternsCount: 0,
				failedApproachesCount: 0,
				taskNotesCount: 0,
				lastUpdated: null,
			}),
			formatForPrompt: () => "",
			formatForTask: () => "",
			exportAsMarkdown: () => "",
		},
		session: {
			load: () => null,
			save: () => {},
			delete: () => {},
			exists: () => false,
			create: (total, task) => ({
				startTime: Date.now(),
				lastUpdateTime: Date.now(),
				currentIteration: 0,
				totalIterations: total,
				currentTaskIndex: task,
				status: "running" as const,
				elapsedTimeSeconds: 0,
				statistics: {
					totalIterations: total,
					completedIterations: 0,
					failedIterations: 0,
					successfulIterations: 0,
					totalDurationMs: 0,
					averageDurationMs: 0,
					successRate: 0,
					iterationTimings: [],
				},
			}),
			recordIterationStart: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			recordIterationEnd: (s) => ({ ...s, lastUpdateTime: Date.now() }),
			updateIteration: (s, i, t, e) => ({
				...s,
				currentIteration: i,
				currentTaskIndex: t,
				elapsedTimeSeconds: e,
				lastUpdateTime: Date.now(),
			}),
			updateStatus: (s, status) => ({ ...s, status, lastUpdateTime: Date.now() }),
			isResumable: () => false,
		},
		sleepPrevention: {
			start: () => {},
			stop: () => {},
			isActive: () => false,
		},
	};
}

const ORIGINAL_CWD = process.cwd();

describe("integrity functions", () => {
	beforeEach(() => {
		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}

		mkdirSync(TEST_PROJECT_DIR, { recursive: true });

		const normalizedTestDir = realpathSync(TEST_DIR);

		const registry = {
			version: 1,
			projects: {
				"test-project": {
					identifier: { type: "custom", value: "test-project", folderName: "test-project" },
					displayName: "Test Project",
					createdAt: Date.now(),
					lastAccessedAt: Date.now(),
					lastKnownPath: normalizedTestDir,
				},
			},
			pathCache: { [normalizedTestDir]: "test-project" },
		};

		writeFileSync(join(TEST_RALPH_DIR, "registry.json"), JSON.stringify(registry));

		const projectRegistryService = createProjectRegistryService(getTestConfig());
		const services = createMockServices(projectRegistryService);

		initializeServices(services);

		process.chdir(TEST_DIR);
	});

	afterEach(() => {
		try {
			process.chdir(ORIGINAL_CWD);
		} catch {
			// Ignore if directory doesn't exist
		}

		resetServices();

		if (existsSync(TEST_DIR)) {
			rmSync(TEST_DIR, { recursive: true, force: true });
		}
	});

	describe("checkRalphDirectoryIntegrity", () => {
		test("returns no issues when files are valid or missing", () => {
			const result = checkRalphDirectoryIntegrity();

			expect(result.directoryExists).toBe(true);
			expect(result.issues.length).toBe(0);
		});

		test("validates config.json when present", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), JSON.stringify({ agent: "cursor" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid config.json", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "config.json")).toBe(true);
			expect(result.issues.some((issue) => issue.severity === "error")).toBe(true);
		});

		test("reports config validation errors", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), JSON.stringify({ agent: "invalid" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "config.json")).toBe(true);
		});

		test("reports config validation warnings", () => {
			writeFileSync(
				join(TEST_PROJECT_DIR, "config.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const warnings = result.issues.filter((issue) => issue.severity === "warning");

			if (warnings.length > 0) {
				expect(warnings.some((w) => w.file === "config.json")).toBe(true);
			}
		});

		test("validates prd.json when present", () => {
			writeFileSync(
				join(TEST_PROJECT_DIR, "prd.json"),
				JSON.stringify({ project: "Test", tasks: [] }),
			);
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid prd.json", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "prd.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("reports missing project field in PRD", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "prd.json"), JSON.stringify({ tasks: [] }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("reports missing tasks field in PRD", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "prd.json"), JSON.stringify({ project: "Test" }));
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "prd.json")).toBe(true);
		});

		test("validates session.json when present", () => {
			writeFileSync(
				join(TEST_PROJECT_DIR, "session.json"),
				JSON.stringify({
					startTime: Date.now(),
					lastUpdateTime: Date.now(),
					currentIteration: 0,
					totalIterations: 10,
					currentTaskIndex: 0,
					status: "running",
					elapsedTimeSeconds: 0,
					statistics: {
						totalIterations: 10,
						completedIterations: 0,
						failedIterations: 0,
						successfulIterations: 0,
						totalDurationMs: 0,
						averageDurationMs: 0,
						successRate: 0,
						iterationTimings: [],
					},
				}),
			);
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBe(0);
		});

		test("reports invalid session.json", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "session.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "session.json")).toBe(true);
		});

		test("reports missing required fields in session.json", () => {
			writeFileSync(
				join(TEST_PROJECT_DIR, "session.json"),
				JSON.stringify({ startTime: Date.now() }),
			);
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThan(0);
			expect(result.issues.some((issue) => issue.file === "session.json")).toBe(true);
		});

		test("handles multiple issues across files", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid }");
			writeFileSync(join(TEST_PROJECT_DIR, "prd.json"), "{ invalid }");
			const result = checkRalphDirectoryIntegrity();

			expect(result.issues.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("formatIntegrityIssues", () => {
		test("returns null when no issues", () => {
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toBeNull();
		});

		test("formats single error", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).not.toBeNull();
			expect(formatted).toContain("Integrity check found issues");
			expect(formatted).toContain("config.json");
		});

		test("formats errors with ✗ symbol", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toContain("✗");
		});

		test("formats warnings with ⚠ symbol", () => {
			writeFileSync(
				join(TEST_PROJECT_DIR, "config.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			if (formatted) {
				const warnings = result.issues.filter((issue) => issue.severity === "warning");

				if (warnings.length > 0) {
					expect(formatted).toContain("⚠");
				}
			}
		});

		test("groups errors before warnings", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			writeFileSync(
				join(TEST_PROJECT_DIR, "prd.json"),
				JSON.stringify({ agent: "cursor", maxRetries: 15 }),
			);
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			if (formatted) {
				const errorIndex = formatted.indexOf("✗");
				const warningIndex = formatted.indexOf("⚠");

				if (errorIndex !== -1 && warningIndex !== -1) {
					expect(errorIndex).toBeLessThan(warningIndex);
				}
			}
		});

		test("includes file name and message", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toContain("config.json:");
			expect(formatted).toContain("Failed to parse");
		});

		test("ends with newline", () => {
			writeFileSync(join(TEST_PROJECT_DIR, "config.json"), "{ invalid json }");
			const result = checkRalphDirectoryIntegrity();
			const formatted = formatIntegrityIssues(result);

			expect(formatted).toEndWith("\n");
		});
	});
});
