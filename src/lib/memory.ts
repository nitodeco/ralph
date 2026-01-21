import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { eventBus } from "./events.ts";
import { getLogger } from "./logger.ts";
import { AgentProcessManager } from "./services/AgentProcessManager.ts";
import { getProjectRegistryService, isInitialized } from "./services/container.ts";
import { IterationTimer } from "./services/IterationTimer.ts";

export const DEFAULT_MAX_OUTPUT_BUFFER_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MEMORY_WARNING_THRESHOLD_MB = 500;
export const DEFAULT_ENABLE_GC_HINTS = true;

const MEMORY_CRITICAL_THRESHOLD_MB = 1024;

interface MemoryUsage {
	heapUsedMB: number;
	heapTotalMB: number;
	rssMB: number;
	externalMB: number;
}

interface MemoryConfig {
	maxOutputBufferBytes?: number;
	memoryWarningThresholdMb?: number;
	enableGarbageCollectionHints?: boolean;
	logFilePath?: string;
}

export function getMemoryUsage(): MemoryUsage {
	const memUsage = process.memoryUsage();

	return {
		heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
		heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
		rssMB: Math.round(memUsage.rss / 1024 / 1024),
		externalMB: Math.round(memUsage.external / 1024 / 1024),
	};
}

export function checkMemoryUsage(config?: MemoryConfig): {
	level: "ok" | "warning" | "critical";
	usage: MemoryUsage;
} {
	const usage = getMemoryUsage();
	const logger = getLogger({ logFilePath: config?.logFilePath });
	const warningThreshold = config?.memoryWarningThresholdMb ?? DEFAULT_MEMORY_WARNING_THRESHOLD_MB;

	if (usage.heapUsedMB >= MEMORY_CRITICAL_THRESHOLD_MB) {
		logger.warn("Critical memory usage detected", {
			heapUsedMB: usage.heapUsedMB,
			thresholdMB: MEMORY_CRITICAL_THRESHOLD_MB,
		});

		return { level: "critical", usage };
	}

	if (warningThreshold > 0 && usage.heapUsedMB >= warningThreshold) {
		logger.warn("High memory usage detected", {
			heapUsedMB: usage.heapUsedMB,
			thresholdMB: warningThreshold,
		});

		return { level: "warning", usage };
	}

	return { level: "ok", usage };
}

export function triggerGarbageCollection(config?: MemoryConfig): void {
	const enableGcHints = config?.enableGarbageCollectionHints ?? DEFAULT_ENABLE_GC_HINTS;

	if (!enableGcHints) {
		return;
	}

	if (typeof Bun !== "undefined" && typeof Bun.gc === "function") {
		Bun.gc(true);
	} else if (typeof global !== "undefined" && typeof global.gc === "function") {
		global.gc();
	}
}

export function performMemoryCleanup(config?: MemoryConfig): void {
	triggerGarbageCollection(config);
	checkMemoryUsage(config);
}

export function truncateOutputBuffer(
	output: string,
	maxBytes: number = DEFAULT_MAX_OUTPUT_BUFFER_BYTES,
): string {
	const encoder = new TextEncoder();
	const bytes = encoder.encode(output);

	if (bytes.length <= maxBytes) {
		return output;
	}

	const truncationMessage = "\n... [output truncated due to size limit] ...\n";
	const truncationBytes = encoder.encode(truncationMessage);
	const availableBytes = maxBytes - truncationBytes.length;

	if (availableBytes <= 0) {
		return truncationMessage;
	}

	const keepFromEndBytes = Math.floor(availableBytes * 0.7);
	const keepFromStartBytes = availableBytes - keepFromEndBytes;

	const startPart = bytes.slice(0, keepFromStartBytes);
	const endPart = bytes.slice(bytes.length - keepFromEndBytes);

	const decoder = new TextDecoder();
	const startText = decoder.decode(startPart);
	const endText = decoder.decode(endPart);

	return startText + truncationMessage + endText;
}

const TEMP_FILE_PATTERNS = [/^\.tmp/, /\.tmp$/, /^temp_/, /_temp$/];

export function cleanupTempFiles(): number {
	let cleanedCount = 0;

	let maybeProjectDir: string | null = null;

	if (isInitialized()) {
		maybeProjectDir = getProjectRegistryService().getProjectDir();
	} else {
		maybeProjectDir = join(process.cwd(), ".ralph");
	}

	if (maybeProjectDir === null) {
		return cleanedCount;
	}

	if (!existsSync(maybeProjectDir)) {
		return cleanedCount;
	}

	try {
		const files = readdirSync(maybeProjectDir);

		for (const file of files) {
			const isTempFile = TEMP_FILE_PATTERNS.some((pattern) => pattern.test(file));

			if (isTempFile) {
				const filePath = join(maybeProjectDir, file);

				try {
					const stats = statSync(filePath);

					if (stats.isFile()) {
						unlinkSync(filePath);
						cleanedCount++;
					}
				} catch {
					// File may have been deleted by another process, ignore
				}
			}
		}
	} catch {
		return cleanedCount;
	}

	return cleanedCount;
}

export function performIterationCleanup(config?: MemoryConfig): {
	memoryStatus: "ok" | "warning" | "critical";
	tempFilesRemoved: number;
} {
	const tempFilesRemoved = cleanupTempFiles();

	triggerGarbageCollection(config);

	const { level: memoryStatus } = checkMemoryUsage(config);

	return {
		memoryStatus,
		tempFilesRemoved,
	};
}

export function getMaxOutputBytes(configValue?: number): number {
	return configValue ?? DEFAULT_MAX_OUTPUT_BUFFER_BYTES;
}

export interface SessionCleanupResult {
	eventListenersCleared: boolean;
	timersCleared: boolean;
	processManagerReset: boolean;
	gcTriggered: boolean;
}

export function performSessionCleanup(config?: MemoryConfig): SessionCleanupResult {
	const logger = getLogger({ logFilePath: config?.logFilePath });

	const result: SessionCleanupResult = {
		eventListenersCleared: false,
		timersCleared: false,
		processManagerReset: false,
		gcTriggered: false,
	};

	try {
		const listenerCountBefore = eventBus.getListenerCount();

		eventBus.removeAllListeners();
		result.eventListenersCleared = true;

		if (listenerCountBefore > 0) {
			logger.debug("Cleared event listeners", { count: listenerCountBefore });
		}
	} catch (error) {
		logger.warn("Failed to clear event listeners", { error: String(error) });
	}

	try {
		IterationTimer.reset();
		result.timersCleared = true;
	} catch (error) {
		logger.warn("Failed to reset iteration timer", { error: String(error) });
	}

	try {
		AgentProcessManager.reset();
		result.processManagerReset = true;
	} catch (error) {
		logger.warn("Failed to reset agent process manager", { error: String(error) });
	}

	try {
		triggerGarbageCollection(config);
		result.gcTriggered = true;
	} catch (error) {
		logger.warn("Failed to trigger garbage collection", { error: String(error) });
	}

	return result;
}

export interface MemoryDiagnostics {
	memoryUsage: MemoryUsage;
	eventListenerCount: number;
	eventListenerStats: Record<string, number>;
	hasActiveProcess: boolean;
	hasActiveTimer: boolean;
}

export function getMemoryDiagnostics(): MemoryDiagnostics {
	return {
		memoryUsage: getMemoryUsage(),
		eventListenerCount: eventBus.getListenerCount(),
		eventListenerStats: eventBus.getListenerStats(),
		hasActiveProcess: AgentProcessManager.isRunning(),
		hasActiveTimer: IterationTimer.isProjectComplete() === false,
	};
}
