import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	createMemoryMonitorService,
	MEMORY_MONITOR_DEFAULTS,
	type MemoryMonitorService,
} from "@/lib/services/MemoryMonitorService.ts";

describe("MemoryMonitorService", () => {
	let service: MemoryMonitorService;

	beforeEach(() => {
		service = createMemoryMonitorService();
	});

	afterEach(() => {
		service.stop();
	});

	describe("createMemoryMonitorService", () => {
		test("creates service with default config", () => {
			expect(service.getThresholdPercent()).toBe(MEMORY_MONITOR_DEFAULTS.thresholdPercent);
			expect(service.isActive()).toBe(false);
		});

		test("creates service with custom config", () => {
			const customService = createMemoryMonitorService({
				thresholdPercent: 90,
				checkIntervalMs: 5000,
			});

			expect(customService.getThresholdPercent()).toBe(90);
			customService.stop();
		});
	});

	describe("start", () => {
		test("starts monitoring", () => {
			const callback = mock(() => {});

			service.start(callback);

			expect(service.isActive()).toBe(true);
		});

		test("does not start if already monitoring", () => {
			const callback1 = mock(() => {});
			const callback2 = mock(() => {});

			service.start(callback1);
			service.start(callback2);

			expect(service.isActive()).toBe(true);
		});
	});

	describe("stop", () => {
		test("stops monitoring", () => {
			const callback = mock(() => {});

			service.start(callback);
			service.stop();

			expect(service.isActive()).toBe(false);
		});

		test("handles stop when not monitoring", () => {
			service.stop();

			expect(service.isActive()).toBe(false);
		});
	});

	describe("isActive", () => {
		test("returns false when not monitoring", () => {
			expect(service.isActive()).toBe(false);
		});

		test("returns true when monitoring", () => {
			const callback = mock(() => {});

			service.start(callback);

			expect(service.isActive()).toBe(true);
		});
	});

	describe("getMemoryUsagePercent", () => {
		test("returns a number between 0 and 100", () => {
			const usage = service.getMemoryUsagePercent();

			expect(typeof usage).toBe("number");
			expect(usage).toBeGreaterThanOrEqual(0);
			expect(usage).toBeLessThanOrEqual(100);
		});

		test("returns a number with at most 2 decimal places", () => {
			const usage = service.getMemoryUsagePercent();
			const decimalPlaces = (usage.toString().split(".")[1] || "").length;

			expect(decimalPlaces).toBeLessThanOrEqual(2);
		});
	});

	describe("setThresholdPercent", () => {
		test("updates threshold percent", () => {
			service.setThresholdPercent(90);

			expect(service.getThresholdPercent()).toBe(90);
		});
	});

	describe("getThresholdPercent", () => {
		test("returns current threshold percent", () => {
			service.setThresholdPercent(80);

			expect(service.getThresholdPercent()).toBe(80);
		});
	});

	describe("MEMORY_MONITOR_DEFAULTS", () => {
		test("has expected default values", () => {
			expect(MEMORY_MONITOR_DEFAULTS.thresholdPercent).toBe(80);
			expect(MEMORY_MONITOR_DEFAULTS.checkIntervalMs).toBe(10_000);
		});
	});
});
