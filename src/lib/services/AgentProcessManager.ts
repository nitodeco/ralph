import type { Subprocess } from "bun";
import { FORCE_KILL_TIMEOUT_MS } from "@/lib/constants/ui.ts";

class AgentProcessManagerClass {
	private process: Subprocess | null = null;
	private processId: number | null = null;
	private aborted = false;
	private retryCount = 0;
	private forceKillTimeout: ReturnType<typeof setTimeout> | null = null;

	getProcess(): Subprocess | null {
		return this.process;
	}

	setProcess(process: Subprocess | null): void {
		if (process !== null && this.process !== null && this.process !== process) {
			this.safeKillProcess(this.process);
		}

		this.process = process;
		this.processId = process?.pid ?? null;
	}

	getProcessId(): number | null {
		return this.processId;
	}

	isProcessAlive(): boolean {
		if (this.process === null) {
			return false;
		}

		try {
			if (this.process.exitCode !== null) {
				return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	validateProcessState(): { isValid: boolean; reason?: string } {
		if (this.process === null && this.processId !== null) {
			return { isValid: false, reason: "Process reference lost but PID still tracked" };
		}

		if (this.process !== null && this.process.pid !== this.processId) {
			return { isValid: false, reason: "Process PID mismatch" };
		}

		return { isValid: true };
	}

	private safeKillProcess(proc: Subprocess): void {
		try {
			proc.kill("SIGTERM");
		} catch {
			// Process may have already exited
		}

		setTimeout(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				// Process may have already exited
			}
		}, FORCE_KILL_TIMEOUT_MS);
	}

	isAborted(): boolean {
		return this.aborted;
	}

	setAborted(value: boolean): void {
		this.aborted = value;
	}

	getRetryCount(): number {
		return this.retryCount;
	}

	incrementRetry(): number {
		this.retryCount += 1;

		return this.retryCount;
	}

	resetRetry(): void {
		this.retryCount = 0;
	}

	isRunning(): boolean {
		return this.process !== null && this.isProcessAlive();
	}

	kill(): void {
		this.aborted = true;
		this.clearForceKillTimeout();

		if (this.process) {
			const processToKill = this.process;
			const pidToKill = this.processId;

			try {
				processToKill.kill("SIGTERM");
			} catch {
				// Process may have already exited, ignore
			}

			this.forceKillTimeout = setTimeout(() => {
				if (this.processId === pidToKill && processToKill) {
					try {
						processToKill.kill("SIGKILL");
					} catch {
						// Process may have already exited, ignore
					}
				}

				this.forceKillTimeout = null;
			}, FORCE_KILL_TIMEOUT_MS);

			this.process = null;
			this.processId = null;
		}
	}

	clearForceKillTimeout(): void {
		if (this.forceKillTimeout) {
			clearTimeout(this.forceKillTimeout);
			this.forceKillTimeout = null;
		}
	}

	reset(): void {
		if (this.process && this.isProcessAlive()) {
			this.safeKillProcess(this.process);
		}

		this.aborted = false;
		this.retryCount = 0;
		this.clearForceKillTimeout();
		this.processId = null;
		this.process = null;
	}
}

export const AgentProcessManager = new AgentProcessManagerClass();
