import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Prd, RalphConfig, Session } from "@/types.ts";
import { validateConfig } from "./config.ts";
import { RALPH_DIR } from "./paths.ts";

const CONFIG_PATH = join(RALPH_DIR, "config.json");
const PRD_JSON_PATH = join(RALPH_DIR, "prd.json");
const PRD_YAML_PATH = join(RALPH_DIR, "prd.yaml");
const SESSION_PATH = join(RALPH_DIR, "session.json");
const GITIGNORE_PATH = join(RALPH_DIR, ".gitignore");

export interface IntegrityIssue {
	file: string;
	message: string;
	severity: "error" | "warning";
}

export interface IntegrityCheckResult {
	directoryExists: boolean;
	issues: IntegrityIssue[];
	gitignoreCreated: boolean;
}

function ensureGitignoreExists(): boolean {
	if (existsSync(GITIGNORE_PATH)) {
		return false;
	}
	writeFileSync(GITIGNORE_PATH, "ralph.log\n", "utf-8");
	return true;
}

function validateConfigFile(issues: IntegrityIssue[]): void {
	if (!existsSync(CONFIG_PATH)) {
		return;
	}

	try {
		const content = readFileSync(CONFIG_PATH, "utf-8");
		const parsed = JSON.parse(content) as RalphConfig;
		const validationResult = validateConfig(parsed);

		for (const error of validationResult.errors) {
			issues.push({
				file: "config.json",
				message: `${error.field}: ${error.message}`,
				severity: "error",
			});
		}

		for (const warning of validationResult.warnings) {
			issues.push({
				file: "config.json",
				message: `${warning.field}: ${warning.message}`,
				severity: "warning",
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		issues.push({
			file: "config.json",
			message: `Failed to parse: ${errorMessage}`,
			severity: "error",
		});
	}
}

function validatePrdFile(issues: IntegrityIssue[]): void {
	const prdPath = existsSync(PRD_JSON_PATH)
		? PRD_JSON_PATH
		: existsSync(PRD_YAML_PATH)
			? PRD_YAML_PATH
			: null;

	if (!prdPath) {
		return;
	}

	const fileName = prdPath === PRD_JSON_PATH ? "prd.json" : "prd.yaml";

	try {
		const content = readFileSync(prdPath, "utf-8");
		let prd: Prd;

		if (prdPath.endsWith(".yaml") || prdPath.endsWith(".yml")) {
			prd = parseYaml(content) as Prd;
		} else {
			prd = JSON.parse(content) as Prd;
		}

		if (typeof prd.project !== "string" || !prd.project) {
			issues.push({
				file: fileName,
				message: "Missing or invalid 'project' field",
				severity: "error",
			});
		}

		if (!Array.isArray(prd.tasks)) {
			issues.push({
				file: fileName,
				message: "Missing or invalid 'tasks' array",
				severity: "error",
			});
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		issues.push({
			file: fileName,
			message: `Failed to parse: ${errorMessage}`,
			severity: "error",
		});
	}
}

function validateSessionFile(issues: IntegrityIssue[]): void {
	if (!existsSync(SESSION_PATH)) {
		return;
	}

	try {
		const content = readFileSync(SESSION_PATH, "utf-8");
		const session = JSON.parse(content) as Session;

		const requiredFields: (keyof Session)[] = [
			"startTime",
			"lastUpdateTime",
			"currentIteration",
			"totalIterations",
			"currentTaskIndex",
			"status",
			"elapsedTimeSeconds",
		];

		for (const field of requiredFields) {
			if (session[field] === undefined) {
				issues.push({
					file: "session.json",
					message: `Missing required field: ${String(field)}`,
					severity: "error",
				});
			}
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		issues.push({
			file: "session.json",
			message: `Failed to parse: ${errorMessage}`,
			severity: "error",
		});
	}
}

export function checkRalphDirectoryIntegrity(): IntegrityCheckResult {
	if (!existsSync(RALPH_DIR)) {
		return {
			directoryExists: false,
			issues: [],
			gitignoreCreated: false,
		};
	}

	const issues: IntegrityIssue[] = [];
	const gitignoreCreated = ensureGitignoreExists();

	validateConfigFile(issues);
	validatePrdFile(issues);
	validateSessionFile(issues);

	return {
		directoryExists: true,
		issues,
		gitignoreCreated,
	};
}

export function formatIntegrityIssues(result: IntegrityCheckResult): string | null {
	if (result.issues.length === 0) {
		return null;
	}

	const lines: string[] = ["Integrity check found issues in .ralph directory:", ""];

	const errors = result.issues.filter((issue) => issue.severity === "error");
	const warnings = result.issues.filter((issue) => issue.severity === "warning");

	if (errors.length > 0) {
		for (const error of errors) {
			lines.push(`  ✗ ${error.file}: ${error.message}`);
		}
	}

	if (warnings.length > 0) {
		for (const warning of warnings) {
			lines.push(`  ⚠ ${warning.file}: ${warning.message}`);
		}
	}

	lines.push("");

	return lines.join("\n");
}
