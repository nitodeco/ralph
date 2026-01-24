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
			expect(service.getThresholdMb()).toBe(MEMORY_MONITOR_DEFAULTS.thresholdMb);
			expect(service.isActive()).toBe(false);
		});

		test("creates service with custom config", () => {
			const customService = createMemoryMonitorService({
				thresholdMb: 2048,
				checkIntervalMs: 5000,
			});

			expect(customService.getThresholdMb()).toBe(2048);
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

	describe("getMemoryUsageMb", () => {
		test("returns a positive number", () => {
			const usage = service.getMemoryUsageMb();

			expect(typeof usage).toBe("number");
			expect(usage).toBeGreaterThan(0);
		});

		test("returns an integer", () => {
			const usage = service.getMemoryUsageMb();

			expect(Number.isInteger(usage)).toBe(true);
		});
	});

	describe("setThresholdMb", () => {
		test("updates threshold mb", () => {
			service.setThresholdMb(2048);

			expect(service.getThresholdMb()).toBe(2048);
		});
	});

	describe("getThresholdMb", () => {
		test("returns current threshold mb", () => {
			service.setThresholdMb(512);

			expect(service.getThresholdMb()).toBe(512);
		});
	});

	describe("MEMORY_MONITOR_DEFAULTS", () => {
		test("has expected default values", () => {
			expect(MEMORY_MONITOR_DEFAULTS.thresholdMb).toBe(1_024);
			expect(MEMORY_MONITOR_DEFAULTS.checkIntervalMs).toBe(10_000);
		});
	});
});
