import { freemem, totalmem } from "node:os";

export interface MemoryMonitorService {
	start(onThresholdExceeded: () => void): void;
	stop(): void;
	isActive(): boolean;
	getMemoryUsagePercent(): number;
	setThresholdPercent(percent: number): void;
	getThresholdPercent(): number;
}

export interface MemoryMonitorConfig {
	thresholdPercent: number;
	checkIntervalMs: number;
}

const DEFAULT_THRESHOLD_PERCENT = 80;
const DEFAULT_CHECK_INTERVAL_MS = 10_000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;
let currentConfig: MemoryMonitorConfig = {
	thresholdPercent: DEFAULT_THRESHOLD_PERCENT,
	checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
};

function getMemoryUsagePercent(): number {
	const totalMemory = totalmem();
	const freeMemory = freemem();
	const usedMemory = totalMemory - freeMemory;
	const usagePercent = (usedMemory / totalMemory) * 100;

	return Math.round(usagePercent * 100) / 100;
}

function startMonitoring(onThresholdExceeded: () => void): void {
	if (isMonitoring) {
		return;
	}

	isMonitoring = true;

	monitorInterval = setInterval(() => {
		const usagePercent = getMemoryUsagePercent();

		if (usagePercent >= currentConfig.thresholdPercent) {
			stopMonitoring();
			onThresholdExceeded();
		}
	}, currentConfig.checkIntervalMs);
}

function stopMonitoring(): void {
	if (monitorInterval !== null) {
		clearInterval(monitorInterval);
		monitorInterval = null;
	}

	isMonitoring = false;
}

function isMonitoringActive(): boolean {
	return isMonitoring;
}

function setThresholdPercent(percent: number): void {
	currentConfig.thresholdPercent = percent;
}

function getThresholdPercent(): number {
	return currentConfig.thresholdPercent;
}

export function createMemoryMonitorService(
	config?: Partial<MemoryMonitorConfig>,
): MemoryMonitorService {
	if (config) {
		currentConfig = {
			thresholdPercent: config.thresholdPercent ?? DEFAULT_THRESHOLD_PERCENT,
			checkIntervalMs: config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
		};
	}

	return {
		start: startMonitoring,
		stop: stopMonitoring,
		isActive: isMonitoringActive,
		getMemoryUsagePercent,
		setThresholdPercent,
		getThresholdPercent,
	};
}

export const MEMORY_MONITOR_DEFAULTS = {
	thresholdPercent: DEFAULT_THRESHOLD_PERCENT,
	checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
} as const;
