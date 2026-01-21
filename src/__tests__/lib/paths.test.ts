import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isGitRepository } from "@/lib/paths.ts";

describe("isGitRepository", () => {
	const testDir = join(tmpdir(), `ralph-test-${Date.now()}`);
	const gitTestDir = join(testDir, "with-git");
	const noGitTestDir = join(testDir, "no-git");

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
		mkdirSync(gitTestDir, { recursive: true });
		mkdirSync(join(gitTestDir, ".git"), { recursive: true });
		mkdirSync(noGitTestDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test("returns true when .git directory exists", () => {
		const result = isGitRepository(gitTestDir);

		expect(result).toBe(true);
	});

	test("returns false when .git directory does not exist", () => {
		const result = isGitRepository(noGitTestDir);

		expect(result).toBe(false);
	});

	test("uses current working directory by default", () => {
		const result = isGitRepository();

		expect(typeof result).toBe("boolean");
	});

	test("returns false for non-existent directory", () => {
		const result = isGitRepository(join(testDir, "non-existent"));

		expect(result).toBe(false);
	});
});
