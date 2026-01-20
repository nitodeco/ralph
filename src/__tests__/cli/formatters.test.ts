import { describe, expect, test } from "bun:test";
import {
	formatBytes,
	formatConfigValue,
	formatDuration,
	formatElapsedTime,
} from "@/cli/formatters.ts";

describe("formatElapsedTime", () => {
	test("formats seconds only", () => {
		expect(formatElapsedTime(45)).toBe("45s");
		expect(formatElapsedTime(0)).toBe("0s");
		expect(formatElapsedTime(59)).toBe("59s");
	});

	test("formats minutes and seconds", () => {
		expect(formatElapsedTime(60)).toBe("1m 0s");
		expect(formatElapsedTime(90)).toBe("1m 30s");
		expect(formatElapsedTime(125)).toBe("2m 5s");
		expect(formatElapsedTime(3599)).toBe("59m 59s");
	});

	test("formats hours, minutes, and seconds", () => {
		expect(formatElapsedTime(3600)).toBe("1h 0s");
		expect(formatElapsedTime(3660)).toBe("1h 1m 0s");
		expect(formatElapsedTime(3661)).toBe("1h 1m 1s");
		expect(formatElapsedTime(7265)).toBe("2h 1m 5s");
	});

	test("handles large values", () => {
		expect(formatElapsedTime(86400)).toBe("24h 0s");
	});
});

describe("formatDuration", () => {
	test("returns disabled for zero", () => {
		expect(formatDuration(0)).toBe("disabled");
	});

	test("formats seconds", () => {
		expect(formatDuration(1000)).toBe("1s");
		expect(formatDuration(30000)).toBe("30s");
		expect(formatDuration(59000)).toBe("59s");
	});

	test("formats minutes", () => {
		expect(formatDuration(60000)).toBe("1m");
		expect(formatDuration(300000)).toBe("5m");
		expect(formatDuration(3540000)).toBe("59m");
	});

	test("formats hours", () => {
		expect(formatDuration(3600000)).toBe("1h");
		expect(formatDuration(7200000)).toBe("2h");
	});
});

describe("formatBytes", () => {
	test("formats bytes", () => {
		expect(formatBytes(0)).toBe("0B");
		expect(formatBytes(512)).toBe("512B");
		expect(formatBytes(1023)).toBe("1023B");
	});

	test("formats kilobytes", () => {
		expect(formatBytes(1024)).toBe("1.0KB");
		expect(formatBytes(1536)).toBe("1.5KB");
		expect(formatBytes(1048575)).toBe("1024.0KB");
	});

	test("formats megabytes", () => {
		expect(formatBytes(1048576)).toBe("1.0MB");
		expect(formatBytes(5242880)).toBe("5.0MB");
		expect(formatBytes(10485760)).toBe("10.0MB");
	});
});

describe("formatConfigValue", () => {
	test("formats null as not set", () => {
		const result = formatConfigValue(null);

		expect(result).toContain("not set");
	});

	test("formats undefined as not set", () => {
		const result = formatConfigValue(undefined);

		expect(result).toContain("not set");
	});

	test("formats boolean true with color", () => {
		const result = formatConfigValue(true);

		expect(result).toContain("true");
		expect(result).toContain("\x1b[32m");
	});

	test("formats boolean false with color", () => {
		const result = formatConfigValue(false);

		expect(result).toContain("false");
		expect(result).toContain("\x1b[31m");
	});

	test("formats numbers with color", () => {
		const result = formatConfigValue(42);

		expect(result).toContain("42");
		expect(result).toContain("\x1b[33m");
	});

	test("formats strings with color", () => {
		const result = formatConfigValue("cursor");

		expect(result).toContain("cursor");
		expect(result).toContain("\x1b[36m");
	});
});
