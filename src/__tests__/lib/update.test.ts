import { describe, expect, test } from "bun:test";
import {
	compareVersions,
	getArchitecture,
	getOperatingSystem,
	getRemoveOldBinaryCommand,
} from "@/lib/update.ts";

describe("compareVersions", () => {
	test("returns 0 for equal versions", () => {
		expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
		expect(compareVersions("v1.0.0", "v1.0.0")).toBe(0);
		expect(compareVersions("1.0.0", "v1.0.0")).toBe(0);
	});

	test("returns 1 when latest is greater", () => {
		expect(compareVersions("1.0.0", "1.0.1")).toBe(1);
		expect(compareVersions("1.0.0", "1.1.0")).toBe(1);
		expect(compareVersions("1.0.0", "2.0.0")).toBe(1);
		expect(compareVersions("0.9.9", "1.0.0")).toBe(1);
	});

	test("returns -1 when current is greater", () => {
		expect(compareVersions("1.0.1", "1.0.0")).toBe(-1);
		expect(compareVersions("1.1.0", "1.0.0")).toBe(-1);
		expect(compareVersions("2.0.0", "1.0.0")).toBe(-1);
	});

	test("handles versions with different segment counts", () => {
		expect(compareVersions("1.0", "1.0.0")).toBe(0);
		expect(compareVersions("1.0.0", "1.0")).toBe(0);
		expect(compareVersions("1.0", "1.0.1")).toBe(1);
	});

	test("handles v prefix", () => {
		expect(compareVersions("v1.0.0", "1.0.1")).toBe(1);
		expect(compareVersions("1.0.0", "v1.0.1")).toBe(1);
		expect(compareVersions("v1.0.0", "v1.0.1")).toBe(1);
	});

	test("compares major versions correctly", () => {
		expect(compareVersions("1.9.9", "2.0.0")).toBe(1);
		expect(compareVersions("10.0.0", "9.9.9")).toBe(-1);
	});

	test("compares minor versions correctly", () => {
		expect(compareVersions("1.0.9", "1.1.0")).toBe(1);
		expect(compareVersions("1.10.0", "1.9.0")).toBe(-1);
	});
});

describe("getArchitecture", () => {
	test("returns valid architecture string", () => {
		const arch = getArchitecture();

		expect(["x64", "arm64"]).toContain(arch);
	});
});

describe("getOperatingSystem", () => {
	test("returns valid OS string", () => {
		const os = getOperatingSystem();

		expect(["darwin", "linux"]).toContain(os);
	});
});

describe("getRemoveOldBinaryCommand", () => {
	test("returns sudo command for system bin directory", () => {
		const command = getRemoveOldBinaryCommand("/usr/local/bin/ralph");

		expect(command).toBe("sudo rm /usr/local/bin/ralph");
	});

	test("returns simple rm command for user directory", () => {
		const command = getRemoveOldBinaryCommand("/home/user/.local/bin/ralph");

		expect(command).toBe("rm /home/user/.local/bin/ralph");
	});

	test("returns simple rm command for tmp directory", () => {
		const command = getRemoveOldBinaryCommand("/tmp/ralph");

		expect(command).toBe("rm /tmp/ralph");
	});
});
