import { appendProgress } from "@/lib/progress.ts";
import { formatVerificationResult, runVerification } from "@/lib/verification.ts";
import type { VerificationConfig, VerificationResult } from "@/types.ts";
import type { VerificationStateCallback } from "./types.ts";

interface VerificationHandlerOptions {
	onStateChange: VerificationStateCallback;
}

export class VerificationHandler {
	private lastResult: VerificationResult | null = null;
	private isRunning = false;
	private onStateChange: VerificationStateCallback;

	constructor(options: VerificationHandlerOptions) {
		this.onStateChange = options.onStateChange;
	}

	reset(): void {
		this.lastResult = null;
		this.isRunning = false;
	}

	getLastResult(): VerificationResult | null {
		return this.lastResult;
	}

	getIsRunning(): boolean {
		return this.isRunning;
	}

	async run(config: VerificationConfig): Promise<VerificationResult> {
		this.isRunning = true;
		this.onStateChange(true, null);

		const verificationResult = await runVerification(config);

		this.lastResult = verificationResult;
		this.isRunning = false;
		this.onStateChange(false, verificationResult);
		appendProgress(formatVerificationResult(verificationResult));

		return verificationResult;
	}
}
