import { spawn } from "node:child_process";
import {
	VERIFICATION_CONTEXT_MAX_LENGTH,
	VERIFICATION_OUTPUT_MAX_LENGTH,
} from "@/lib/constants/ui.ts";
import type { CheckResult, VerificationConfig, VerificationResult } from "@/types.ts";

export async function runCheck(name: string, command: string): Promise<CheckResult> {
	const startTime = Date.now();

	return new Promise((resolve) => {
		const [cmd, ...args] = command.split(" ");

		if (!cmd) {
			resolve({
				name,
				passed: false,
				output: "Invalid command: empty command string",
				durationMs: Date.now() - startTime,
			});

			return;
		}

		const childProcess = spawn(cmd, args, {
			shell: true,
			stdio: ["ignore", "pipe", "pipe"],
			cwd: process.cwd(),
		});

		let stdout = "";
		let stderr = "";

		childProcess.stdout?.on("data", (data: Buffer) => {
			stdout += data.toString();
		});

		childProcess.stderr?.on("data", (data: Buffer) => {
			stderr += data.toString();
		});

		childProcess.on("close", (exitCode) => {
			const durationMs = Date.now() - startTime;
			const passed = exitCode === 0;
			const output = stdout + (stderr ? `\n${stderr}` : "");

			resolve({
				name,
				passed,
				output: output.trim().slice(-VERIFICATION_OUTPUT_MAX_LENGTH),
				durationMs,
			});
		});

		childProcess.on("error", (error) => {
			resolve({
				name,
				passed: false,
				output: `Failed to execute command: ${error.message}`,
				durationMs: Date.now() - startTime,
			});
		});
	});
}

export async function runVerification(config: VerificationConfig): Promise<VerificationResult> {
	const startTime = Date.now();
	const checks: CheckResult[] = [];
	const failedChecks: string[] = [];

	if (!config.enabled) {
		return {
			passed: true,
			checks: [],
			failedChecks: [],
			totalDurationMs: 0,
		};
	}

	if (config.buildCommand) {
		const buildResult = await runCheck("build", config.buildCommand);

		checks.push(buildResult);

		if (!buildResult.passed) {
			failedChecks.push("build");
		}
	}

	if (config.lintCommand) {
		const lintResult = await runCheck("lint", config.lintCommand);

		checks.push(lintResult);

		if (!lintResult.passed) {
			failedChecks.push("lint");
		}
	}

	if (config.testCommand) {
		const testResult = await runCheck("test", config.testCommand);

		checks.push(testResult);

		if (!testResult.passed) {
			failedChecks.push("test");
		}
	}

	if (config.customChecks && config.customChecks.length > 0) {
		for (const [checkIndex, customCommand] of config.customChecks.entries()) {
			const checkName = `custom-${checkIndex + 1}`;
			const customResult = await runCheck(checkName, customCommand);

			checks.push(customResult);

			if (!customResult.passed) {
				failedChecks.push(checkName);
			}
		}
	}

	const totalDurationMs = Date.now() - startTime;
	const passed = failedChecks.length === 0;

	return {
		passed,
		checks,
		failedChecks,
		totalDurationMs,
	};
}

export function formatVerificationResult(result: VerificationResult): string {
	const lines: string[] = ["=== Verification Results ==="];

	if (result.checks.length === 0) {
		lines.push("No verification checks configured");

		return lines.join("\n");
	}

	for (const check of result.checks) {
		const status = check.passed ? "PASS" : "FAIL";
		const duration = `${check.durationMs}ms`;

		lines.push(`  ${status}: ${check.name} (${duration})`);

		if (!check.passed && check.output) {
			const outputLines = check.output.split("\n").slice(0, 5);

			for (const outputLine of outputLines) {
				lines.push(`    ${outputLine}`);
			}

			if (check.output.split("\n").length > 5) {
				lines.push("    ...(truncated)");
			}
		}
	}

	lines.push("");
	lines.push(`Total: ${result.checks.length} checks, ${result.failedChecks.length} failed`);
	lines.push(`Duration: ${result.totalDurationMs}ms`);
	lines.push(`Status: ${result.passed ? "PASSED" : "FAILED"}`);

	return lines.join("\n");
}

export function generateVerificationRetryContext(result: VerificationResult): string {
	if (result.passed || result.failedChecks.length === 0) {
		return "";
	}

	const lines: string[] = [
		"## Verification Failed",
		"",
		"The previous iteration completed but verification checks failed:",
		"",
	];

	for (const check of result.checks) {
		if (!check.passed) {
			lines.push(`### ${check.name} check failed`);
			lines.push("");

			if (check.output) {
				lines.push("```");
				lines.push(check.output.slice(0, VERIFICATION_CONTEXT_MAX_LENGTH));
				lines.push("```");
				lines.push("");
			}
		}
	}

	lines.push("Please fix the issues identified by the verification checks before proceeding.");

	return lines.join("\n");
}
