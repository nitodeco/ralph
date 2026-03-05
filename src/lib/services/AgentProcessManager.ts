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
  private processes = new Map<string, ProcessEntry>();
  private pendingKillTimeouts = new Set<ReturnType<typeof setTimeout>>();
  private abortedProcessIds = new Set<string>();
  private globalAborted = false;

  getProcess(id: string = DEFAULT_PROCESS_ID): Subprocess | null {
    return this.processes.get(id)?.process ?? null;
  }

  setProcess(process: Subprocess | null, id: string = DEFAULT_PROCESS_ID): void {
    const existingEntry = this.processes.get(id);

    if (process === null) {
      if (existingEntry) {
        if (this.isProcessAliveById(id)) {
          this.safeKillProcess(existingEntry.process);
        }

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
      aborted: false,
      createdAt: Date.now(),
      forceKillTimeout: null,
      process,
      processId: process.pid,
      retryCount: existingEntry?.retryCount ?? 0,
    });
    this.abortedProcessIds.delete(id);
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
      aborted: entry.aborted,
      createdAt: entry.createdAt,
      id,
      isAlive: this.isProcessAliveById(id),
      processId: entry.processId,
      retryCount: entry.retryCount,
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

    void proc.exited.finally(() => {
      clearTimeout(killTimeout);
      this.pendingKillTimeouts.delete(killTimeout);
    });
  }

  private cleanupEntry(_id: string, entry: ProcessEntry): void {
    if (entry.forceKillTimeout) {
      clearTimeout(entry.forceKillTimeout);
      this.pendingKillTimeouts.delete(entry.forceKillTimeout);
      entry.forceKillTimeout = null;
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

    if (this.abortedProcessIds.has(id)) {
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
      } else {
        this.abortedProcessIds.clear();
      }

      return;
    }

    const entry = this.processes.get(id);

    if (entry) {
      entry.aborted = value;
    }

    if (value) {
      this.abortedProcessIds.add(id);
    } else {
      this.abortedProcessIds.delete(id);
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
      this.abortedProcessIds.add(id);

      return;
    }

    entry.aborted = true;
    this.abortedProcessIds.add(id);

    if (entry.forceKillTimeout) {
      clearTimeout(entry.forceKillTimeout);
      this.pendingKillTimeouts.delete(entry.forceKillTimeout);
      entry.forceKillTimeout = null;
    }

    const processToKill = entry.process;

    try {
      processToKill.kill("SIGTERM");
    } catch {
      // Process may have already exited, ignore
    }

    const forceKillTimeout = setTimeout(() => {
      try {
        processToKill.kill("SIGKILL");
      } catch {
        // Process may have already exited, ignore
      }

      this.pendingKillTimeouts.delete(forceKillTimeout);
    }, FORCE_KILL_TIMEOUT_MS);

    entry.forceKillTimeout = forceKillTimeout;
    this.pendingKillTimeouts.add(forceKillTimeout);

    void processToKill.exited.finally(() => {
      clearTimeout(forceKillTimeout);
      this.pendingKillTimeouts.delete(forceKillTimeout);
    });

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
      this.pendingKillTimeouts.delete(entry.forceKillTimeout);
      entry.forceKillTimeout = null;
    }
  }

  clearAllForceKillTimeouts(): void {
    for (const entry of this.processes.values()) {
      if (entry.forceKillTimeout) {
        clearTimeout(entry.forceKillTimeout);
        this.pendingKillTimeouts.delete(entry.forceKillTimeout);
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
      this.abortedProcessIds.clear();
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
    this.abortedProcessIds.delete(id);
  }

  resetAll(): void {
    this.reset();
  }
}

export const AgentProcessManager = new AgentProcessManagerClass();
