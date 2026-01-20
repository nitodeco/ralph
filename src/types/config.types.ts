export interface CheckResult {
	name: string;
	passed: boolean;
	output: string;
	durationMs: number;
}

export interface VerificationResult {
	passed: boolean;
	checks: CheckResult[];
	failedChecks: string[];
	totalDurationMs: number;
}
