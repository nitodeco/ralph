import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Session } from "@/types.ts";
import { validateConfig } from "./config.ts";
import { getErrorMessage } from "./errors.ts";
import { RALPH_DIR } from "./paths.ts";
import { isPrd } from "./services/prd/validation.ts";
import { isSession } from "./services/session/validation.ts";

const CONFIG_PATH = join(RALPH_DIR, "config.json");
const PRD_JSON_PATH = join(RALPH_DIR, "prd.json");
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
		const parsed: unknown = JSON.parse(content);
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
		const errorMessage = getErrorMessage(error);

		issues.push({
			file: "config.json",
			message: `Failed to parse: ${errorMessage}`,
			severity: "error",
		});
	}
}

function validatePrdFile(issues: IntegrityIssue[]): void {
	if (!existsSync(PRD_JSON_PATH)) {
		return;
	}

	try {
		const content = readFileSync(PRD_JSON_PATH, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isPrd(parsed)) {
			issues.push({
				file: "prd.json",
				message: "Missing or invalid PRD structure",
				severity: "error",
			});
		}
	} catch (error) {
		const errorMessage = getErrorMessage(error);

		issues.push({
			file: "prd.json",
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
		const parsed: unknown = JSON.parse(content);

		if (!isSession(parsed)) {
			issues.push({
				file: "session.json",
				message: "Invalid session structure",
				severity: "error",
			});

			return;
		}

		const session = parsed;

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
		const errorMessage = getErrorMessage(error);

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
