import { existsSync, readFileSync } from "node:fs";
import type { Session } from "@/types.ts";
import { getErrorMessage } from "./errors.ts";
import { getPrdJsonPath, getProjectConfigPath, getSessionFilePath } from "./paths.ts";
import { validateConfig } from "./services/index.ts";
import { isPrd } from "./services/prd/validation.ts";
import { isSession } from "./services/session/validation.ts";

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

function validateConfigFile(issues: IntegrityIssue[]): void {
	const configPath = getProjectConfigPath();

	if (!existsSync(configPath)) {
		return;
	}

	try {
		const content = readFileSync(configPath, "utf-8");
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
	const prdPath = getPrdJsonPath();

	if (!existsSync(prdPath)) {
		return;
	}

	try {
		const content = readFileSync(prdPath, "utf-8");
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
	const sessionPath = getSessionFilePath();

	if (!existsSync(sessionPath)) {
		return;
	}

	try {
		const content = readFileSync(sessionPath, "utf-8");
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
	const issues: IntegrityIssue[] = [];

	validateConfigFile(issues);
	validatePrdFile(issues);
	validateSessionFile(issues);

	return {
		directoryExists: true,
		issues,
		gitignoreCreated: false,
	};
}

export function formatIntegrityIssues(result: IntegrityCheckResult): string | null {
	if (result.issues.length === 0) {
		return null;
	}

	const lines: string[] = ["Integrity check found issues in project configuration:", ""];

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
