import type { Subprocess } from "bun";
import { FORCE_KILL_TIMEOUT_MS } from "@/lib/constants/ui.ts";

class AgentProcessManagerClass {
	private process: Subprocess | null = null;
	private aborted = false;
	private retryCount = 0;
	private forceKillTimeout: ReturnType<typeof setTimeout> | null = null;

	getProcess(): Subprocess | null {
		return this.process;
	}

	setProcess(process: Subprocess | null): void {
		this.process = process;
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
		return this.process !== null;
	}

	kill(): void {
		this.aborted = true;
		this.clearForceKillTimeout();

		if (this.process) {
			const processToKill = this.process;

			try {
				processToKill.kill("SIGTERM");
			} catch {
				// Process may have already exited, ignore
			}

			this.forceKillTimeout = setTimeout(() => {
				if (this.process === processToKill) {
					try {
						processToKill.kill("SIGKILL");
					} catch {
						// Process may have already exited, ignore
					}

					this.process = null;
				}

				this.forceKillTimeout = null;
			}, FORCE_KILL_TIMEOUT_MS);

			this.process = null;
		}
	}

	clearForceKillTimeout(): void {
		if (this.forceKillTimeout) {
			clearTimeout(this.forceKillTimeout);
			this.forceKillTimeout = null;
		}
	}

	reset(): void {
		this.aborted = false;
		this.retryCount = 0;
		this.clearForceKillTimeout();
		this.process = null;
	}
}

export const AgentProcessManager = new AgentProcessManagerClass();
