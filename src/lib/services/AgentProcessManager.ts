import type { Subprocess } from "bun";
import { FORCE_KILL_TIMEOUT_MS } from "@/lib/constants/ui.ts";

const DEFAULT_PROCESS_ID = "__default__";

export interface ProcessEntry {
	process: Subprocess;
	processId: number;
	aborted: boolean;
	retryCount: number;
	forceKillTimeout: ReturnType<typeof setTimeout> | null;
	createdAt: number;
}

export interface ProcessInfo {
	id: string;
	processId: number;
	isAlive: boolean;
	aborted: boolean;
	retryCount: number;
	createdAt: number;
}

class AgentProcessManagerClass {
	private processes: Map<string, ProcessEntry> = new Map();
	private pendingKillTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();
	private globalAborted = false;

	getProcess(id: string = DEFAULT_PROCESS_ID): Subprocess | null {
		return this.processes.get(id)?.process ?? null;
	}

	setProcess(process: Subprocess | null, id: string = DEFAULT_PROCESS_ID): void {
		const existingEntry = this.processes.get(id);

		if (process === null) {
			if (existingEntry) {
				this.cleanupEntry(id, existingEntry);
				this.processes.delete(id);
			}

			return;
		}

		if (existingEntry && existingEntry.process !== process) {
			this.safeKillProcess(existingEntry.process);
			this.cleanupEntry(id, existingEntry);
		}

		this.processes.set(id, {
			process,
			processId: process.pid,
			aborted: false,
			retryCount: existingEntry?.retryCount ?? 0,
			forceKillTimeout: null,
			createdAt: Date.now(),
		});
	}

	registerProcess(id: string, process: Subprocess): void {
		this.setProcess(process, id);
	}

	unregisterProcess(id: string): void {
		this.setProcess(null, id);
	}

	getProcessById(id: string): Subprocess | null {
		return this.getProcess(id);
	}

	getAllProcessIds(): string[] {
		return [...this.processes.keys()];
	}

	getAllProcessInfo(): ProcessInfo[] {
		return [...this.processes.entries()].map(([id, entry]) => ({
			id,
			processId: entry.processId,
			isAlive: this.isProcessAliveById(id),
			aborted: entry.aborted,
			retryCount: entry.retryCount,
			createdAt: entry.createdAt,
		}));
	}

	getActiveProcessCount(): number {
		let activeCount = 0;

		for (const [id] of this.processes) {
			if (this.isProcessAliveById(id)) {
				activeCount++;
			}
		}

		return activeCount;
	}

	getProcessId(id: string = DEFAULT_PROCESS_ID): number | null {
		return this.processes.get(id)?.processId ?? null;
	}

	private isProcessAliveById(id: string): boolean {
		const entry = this.processes.get(id);

		if (!entry) {
			return false;
		}

		try {
			return entry.process.exitCode === null;
		} catch {
			return false;
		}
	}

	isProcessAlive(id: string = DEFAULT_PROCESS_ID): boolean {
		return this.isProcessAliveById(id);
	}

	validateProcessState(id: string = DEFAULT_PROCESS_ID): { isValid: boolean; reason?: string } {
		const entry = this.processes.get(id);

		if (!entry) {
			return { isValid: true };
		}

		if (entry.process.pid !== entry.processId) {
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

		const killTimeout = setTimeout(() => {
			try {
				proc.kill("SIGKILL");
			} catch {
				// Process may have already exited
			}

			this.pendingKillTimeouts.delete(killTimeout);
		}, FORCE_KILL_TIMEOUT_MS);

		this.pendingKillTimeouts.add(killTimeout);
	}

	private cleanupEntry(_id: string, entry: ProcessEntry): void {
		if (entry.forceKillTimeout) {
			clearTimeout(entry.forceKillTimeout);
		}
	}

	clearPendingKillTimeouts(): void {
		for (const timeout of this.pendingKillTimeouts) {
			clearTimeout(timeout);
		}

		this.pendingKillTimeouts.clear();
	}

	isAborted(id: string = DEFAULT_PROCESS_ID): boolean {
		if (this.globalAborted) {
			return true;
		}

		const entry = this.processes.get(id);

		return entry?.aborted ?? false;
	}

	setAborted(value: boolean, id?: string): void {
		if (id === undefined) {
			this.globalAborted = value;

			if (value) {
				for (const entry of this.processes.values()) {
					entry.aborted = true;
				}
			}

			return;
		}

		const entry = this.processes.get(id);

		if (entry) {
			entry.aborted = value;
		}
	}

	isGloballyAborted(): boolean {
		return this.globalAborted;
	}

	getRetryCount(id: string = DEFAULT_PROCESS_ID): number {
		return this.processes.get(id)?.retryCount ?? 0;
	}

	incrementRetry(id: string = DEFAULT_PROCESS_ID): number {
		const entry = this.processes.get(id);

		if (entry) {
			entry.retryCount += 1;

			return entry.retryCount;
		}

		return 0;
	}

	resetRetry(id: string = DEFAULT_PROCESS_ID): void {
		const entry = this.processes.get(id);

		if (entry) {
			entry.retryCount = 0;
		}
	}

	isRunning(id: string = DEFAULT_PROCESS_ID): boolean {
		return this.isProcessAliveById(id);
	}

	isAnyRunning(): boolean {
		for (const [id] of this.processes) {
			if (this.isProcessAliveById(id)) {
				return true;
			}
		}

		return false;
	}

	kill(id: string = DEFAULT_PROCESS_ID): void {
		const entry = this.processes.get(id);

		if (!entry) {
			return;
		}

		entry.aborted = true;

		if (entry.forceKillTimeout) {
			clearTimeout(entry.forceKillTimeout);
			entry.forceKillTimeout = null;
		}

		const processToKill = entry.process;
		const pidToKill = entry.processId;

		try {
			processToKill.kill("SIGTERM");
		} catch {
			// Process may have already exited, ignore
		}

		entry.forceKillTimeout = setTimeout(() => {
			const currentEntry = this.processes.get(id);

			if (currentEntry && currentEntry.processId === pidToKill) {
				try {
					processToKill.kill("SIGKILL");
				} catch {
					// Process may have already exited, ignore
				}

				currentEntry.forceKillTimeout = null;
			}
		}, FORCE_KILL_TIMEOUT_MS);

		this.processes.delete(id);
	}

	killAll(): void {
		this.globalAborted = true;

		for (const [id] of this.processes) {
			this.kill(id);
		}
	}

	clearForceKillTimeout(id: string = DEFAULT_PROCESS_ID): void {
		const entry = this.processes.get(id);

		if (entry?.forceKillTimeout) {
			clearTimeout(entry.forceKillTimeout);
			entry.forceKillTimeout = null;
		}
	}

	clearAllForceKillTimeouts(): void {
		for (const entry of this.processes.values()) {
			if (entry.forceKillTimeout) {
				clearTimeout(entry.forceKillTimeout);
				entry.forceKillTimeout = null;
			}
		}
	}

	reset(id?: string): void {
		if (id === undefined) {
			for (const [processId, entry] of this.processes) {
				if (this.isProcessAliveById(processId)) {
					this.safeKillProcess(entry.process);
				}

				this.cleanupEntry(processId, entry);
			}

			this.processes.clear();
			this.globalAborted = false;
			this.clearPendingKillTimeouts();

			return;
		}

		const entry = this.processes.get(id);

		if (!entry) {
			return;
		}

		if (this.isProcessAliveById(id)) {
			this.safeKillProcess(entry.process);
		}

		this.cleanupEntry(id, entry);
		this.processes.delete(id);
	}

	resetAll(): void {
		this.reset();
	}
}

export const AgentProcessManager = new AgentProcessManagerClass();
