export interface MemoryMonitorService {
	start(onThresholdExceeded: () => void): void;
	stop(): void;
	isActive(): boolean;
	getMemoryUsageMb(): number;
	setThresholdMb(mb: number): void;
	getThresholdMb(): number;
}

export interface MemoryMonitorConfig {
	thresholdMb: number;
	checkIntervalMs: number;
}

const DEFAULT_THRESHOLD_MB = 1_024;
const DEFAULT_CHECK_INTERVAL_MS = 10_000;

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let isMonitoring = false;
let currentConfig: MemoryMonitorConfig = {
	thresholdMb: DEFAULT_THRESHOLD_MB,
	checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
};

function getMemoryUsageMb(): number {
	const { rss } = process.memoryUsage();

	return Math.round(rss / 1024 / 1024);
}

function startMonitoring(onThresholdExceeded: () => void): void {
	if (isMonitoring) {
		return;
	}

	isMonitoring = true;

	monitorInterval = setInterval(() => {
		const usageMb = getMemoryUsageMb();

		if (usageMb >= currentConfig.thresholdMb) {
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

function setThresholdMb(mb: number): void {
	currentConfig.thresholdMb = mb;
}

function getThresholdMb(): number {
	return currentConfig.thresholdMb;
}

export function createMemoryMonitorService(
	config?: Partial<MemoryMonitorConfig>,
): MemoryMonitorService {
	if (config) {
		currentConfig = {
			thresholdMb: config.thresholdMb ?? DEFAULT_THRESHOLD_MB,
			checkIntervalMs: config.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
		};
	}

	return {
		start: startMonitoring,
		stop: stopMonitoring,
		isActive: isMonitoringActive,
		getMemoryUsageMb,
		setThresholdMb,
		getThresholdMb,
	};
}

export const MEMORY_MONITOR_DEFAULTS = {
	thresholdMb: DEFAULT_THRESHOLD_MB,
	checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
} as const;
