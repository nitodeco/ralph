import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type ContentHash = string;

export interface OperationEntry {
  operationId: string;
  timestamp: number;
  contentHash: ContentHash | null;
}

export interface IdempotentWriteResult {
  written: boolean;
  reason: "changed" | "unchanged" | "new_file";
  contentHash: ContentHash;
}

export interface OperationTracker {
  track: (operationId: string, contentHash?: ContentHash | null) => boolean;
  isTracked: (operationId: string) => boolean;
  getEntry: (operationId: string) => OperationEntry | null;
  clear: () => void;
  clearStale: (maxAgeMs: number) => number;
  size: () => number;
}

const DEFAULT_OPERATION_TTL_MS = 5 * 60 * 1000;

export function computeContentHash(content: string): ContentHash {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function computeFileHash(filePath: string): ContentHash | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, "utf8");

    return computeContentHash(content);
  } catch {
    return null;
  }
}

export function writeFileAtomic(filePath: string, content: string): void {
  const directory = dirname(filePath);
  const tempPath = join(directory, `.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);

  try {
    writeFileSync(tempPath, content, "utf8");
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    throw error;
  }
}

export function writeFileIdempotent(filePath: string, content: string): IdempotentWriteResult {
  const newContentHash = computeContentHash(content);

  if (!existsSync(filePath)) {
    writeFileAtomic(filePath, content);

    return { contentHash: newContentHash, reason: "new_file", written: true };
  }

  const existingHash = computeFileHash(filePath);

  if (existingHash === newContentHash) {
    return { contentHash: newContentHash, reason: "unchanged", written: false };
  }

  writeFileAtomic(filePath, content);

  return { contentHash: newContentHash, reason: "changed", written: true };
}

export function createOperationTracker(): OperationTracker {
  const operations = new Map<string, OperationEntry>();

  return {
    clear(): void {
      operations.clear();
    },

    clearStale(maxAgeMs: number = DEFAULT_OPERATION_TTL_MS): number {
      const now = Date.now();
      let clearedCount = 0;

      for (const [operationId, entry] of operations) {
        if (now - entry.timestamp > maxAgeMs) {
          operations.delete(operationId);
          clearedCount++;
        }
      }

      return clearedCount;
    },

    getEntry(operationId: string): OperationEntry | null {
      return operations.get(operationId) ?? null;
    },

    isTracked(operationId: string): boolean {
      return operations.has(operationId);
    },

    size(): number {
      return operations.size;
    },

    track(operationId: string, contentHash: ContentHash | null = null): boolean {
      if (operations.has(operationId)) {
        return false;
      }

      operations.set(operationId, {
        contentHash,
        operationId,
        timestamp: Date.now(),
      });

      return true;
    },
  };
}

export function createOperationId(...parts: (string | number | null | undefined)[]): string {
  const filteredParts = parts.filter(
    (part): part is string | number => part !== null && part !== undefined,
  );

  return filteredParts.join(":");
}

export interface DebouncedWriterOptions {
  debounceMs?: number;
  writeFunction?: (filePath: string, content: string) => void;
}

export interface DebouncedWriter {
  scheduleWrite: (filePath: string, content: string) => void;
  flush: () => void;
  cancel: (filePath: string) => void;
  cancelAll: () => void;
  hasPending: (filePath: string) => boolean;
  getPendingCount: () => number;
}

const DEFAULT_DEBOUNCE_MS = 100;

export function createDebouncedWriter(options: DebouncedWriterOptions = {}): DebouncedWriter {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, writeFunction = writeFileIdempotent } = options;

  interface PendingWrite {
    content: string;
    timeoutId: ReturnType<typeof setTimeout>;
  }

  const pendingWrites = new Map<string, PendingWrite>();

  function executeWrite(filePath: string, content: string): void {
    pendingWrites.delete(filePath);
    writeFunction(filePath, content);
  }

  return {
    cancel(filePath: string): void {
      const pending = pendingWrites.get(filePath);

      if (pending) {
        clearTimeout(pending.timeoutId);
        pendingWrites.delete(filePath);
      }
    },

    cancelAll(): void {
      for (const [, pending] of pendingWrites) {
        clearTimeout(pending.timeoutId);
      }

      pendingWrites.clear();
    },

    flush(): void {
      for (const [filePath, pending] of pendingWrites) {
        clearTimeout(pending.timeoutId);
        executeWrite(filePath, pending.content);
      }
    },

    getPendingCount(): number {
      return pendingWrites.size;
    },

    hasPending(filePath: string): boolean {
      return pendingWrites.has(filePath);
    },

    scheduleWrite(filePath: string, content: string): void {
      const existing = pendingWrites.get(filePath);

      if (existing) {
        clearTimeout(existing.timeoutId);
      }

      const timeoutId = setTimeout(() => executeWrite(filePath, content), debounceMs);

      pendingWrites.set(filePath, { content, timeoutId });
    },
  };
}

export interface BatchedUpdater<T> {
  update: (updater: (current: T) => T) => void;
  flush: () => void;
  cancel: () => void;
  hasPending: () => boolean;
}

export interface BatchedUpdaterOptions<T> {
  debounceMs?: number;
  load: () => T;
  save: (value: T) => void;
}

export function createBatchedUpdater<T>(options: BatchedUpdaterOptions<T>): BatchedUpdater<T> {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, load, save } = options;

  let pendingUpdaters: ((current: T) => T)[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function executeUpdate(): void {
    if (pendingUpdaters.length === 0) {
      return;
    }

    const updaters = pendingUpdaters;

    pendingUpdaters = [];
    timeoutId = null;

    let currentState = load();

    for (const updater of updaters) {
      currentState = updater(currentState);
    }

    save(currentState);
  }

  return {
    cancel(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      pendingUpdaters = [];
    },

    flush(): void {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      executeUpdate();
    },

    hasPending(): boolean {
      return pendingUpdaters.length > 0;
    },

    update(updater: (current: T) => T): void {
      pendingUpdaters.push(updater);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(executeUpdate, debounceMs);
    },
  };
}
