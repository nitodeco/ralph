import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	computeContentHash,
	computeFileHash,
	createBatchedUpdater,
	createDebouncedWriter,
	createOperationId,
	createOperationTracker,
	writeFileAtomic,
	writeFileIdempotent,
} from "@/lib/idempotency.ts";

const TEST_DIR = join(process.cwd(), "src/__tests__/__test__/idempotency");

function ensureTestDir(): void {
	if (!existsSync(TEST_DIR)) {
		mkdirSync(TEST_DIR, { recursive: true });
	}
}

function cleanupTestDir(): void {
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}
}

describe("computeContentHash", () => {
	test("returns consistent hash for same content", () => {
		const content = "test content";
		const hash1 = computeContentHash(content);
		const hash2 = computeContentHash(content);

		expect(hash1).toBe(hash2);
	});

	test("returns different hash for different content", () => {
		const hash1 = computeContentHash("content 1");
		const hash2 = computeContentHash("content 2");

		expect(hash1).not.toBe(hash2);
	});

	test("returns 16-character hex string", () => {
		const hash = computeContentHash("test");

		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});

	test("handles empty string", () => {
		const hash = computeContentHash("");

		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});

	test("handles unicode content", () => {
		const hash = computeContentHash("Unicode: 日本語 🎉");

		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});
});

describe("computeFileHash", () => {
	beforeEach(() => {
		ensureTestDir();
	});

	afterEach(() => {
		cleanupTestDir();
	});

	test("returns null for non-existent file", () => {
		const result = computeFileHash(join(TEST_DIR, "nonexistent.txt"));

		expect(result).toBeNull();
	});

	test("returns hash for existing file", () => {
		const filePath = join(TEST_DIR, "test.txt");

		writeFileSync(filePath, "test content");
		const hash = computeFileHash(filePath);

		expect(hash).toMatch(/^[a-f0-9]{16}$/);
	});

	test("returns same hash as computeContentHash for same content", () => {
		const content = "test content";
		const filePath = join(TEST_DIR, "test.txt");

		writeFileSync(filePath, content);

		const fileHash = computeFileHash(filePath);
		const contentHash = computeContentHash(content);

		expect(fileHash).toBe(contentHash);
	});
});

describe("writeFileAtomic", () => {
	beforeEach(() => {
		ensureTestDir();
	});

	afterEach(() => {
		cleanupTestDir();
	});

	test("writes content to new file", () => {
		const filePath = join(TEST_DIR, "new.txt");
		const content = "new content";

		writeFileAtomic(filePath, content);

		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, "utf-8")).toBe(content);
	});

	test("overwrites existing file", () => {
		const filePath = join(TEST_DIR, "existing.txt");

		writeFileSync(filePath, "old content");

		writeFileAtomic(filePath, "new content");

		expect(readFileSync(filePath, "utf-8")).toBe("new content");
	});

	test("handles unicode content", () => {
		const filePath = join(TEST_DIR, "unicode.txt");
		const content = "Unicode: 日本語 🎉";

		writeFileAtomic(filePath, content);

		expect(readFileSync(filePath, "utf-8")).toBe(content);
	});

	test("cleans up temp file on failure", () => {
		const invalidPath = join(TEST_DIR, "nonexistent-dir", "file.txt");

		expect(() => writeFileAtomic(invalidPath, "content")).toThrow();

		const parentDir = join(TEST_DIR, "nonexistent-dir");

		expect(existsSync(parentDir)).toBe(false);
	});
});

describe("writeFileIdempotent", () => {
	beforeEach(() => {
		ensureTestDir();
	});

	afterEach(() => {
		cleanupTestDir();
	});

	test("writes new file and returns new_file reason", () => {
		const filePath = join(TEST_DIR, "new.txt");
		const content = "new content";

		const result = writeFileIdempotent(filePath, content);

		expect(result.written).toBe(true);
		expect(result.reason).toBe("new_file");
		expect(result.contentHash).toMatch(/^[a-f0-9]{16}$/);
		expect(readFileSync(filePath, "utf-8")).toBe(content);
	});

	test("skips write and returns unchanged for identical content", () => {
		const filePath = join(TEST_DIR, "existing.txt");
		const content = "same content";

		writeFileSync(filePath, content);

		const result = writeFileIdempotent(filePath, content);

		expect(result.written).toBe(false);
		expect(result.reason).toBe("unchanged");
		expect(result.contentHash).toMatch(/^[a-f0-9]{16}$/);
	});

	test("writes and returns changed for different content", () => {
		const filePath = join(TEST_DIR, "existing.txt");

		writeFileSync(filePath, "old content");

		const result = writeFileIdempotent(filePath, "new content");

		expect(result.written).toBe(true);
		expect(result.reason).toBe("changed");
		expect(readFileSync(filePath, "utf-8")).toBe("new content");
	});

	test("returns consistent hash for same content", () => {
		const filePath = join(TEST_DIR, "test.txt");
		const content = "test content";

		const result1 = writeFileIdempotent(filePath, content);
		const result2 = writeFileIdempotent(filePath, content);

		expect(result1.contentHash).toBe(result2.contentHash);
		expect(result1.reason).toBe("new_file");
		expect(result2.reason).toBe("unchanged");
	});
});

describe("createOperationTracker", () => {
	test("tracks new operation and returns true", () => {
		const tracker = createOperationTracker();

		const tracked = tracker.track("op-1");

		expect(tracked).toBe(true);
		expect(tracker.isTracked("op-1")).toBe(true);
	});

	test("returns false for duplicate operation", () => {
		const tracker = createOperationTracker();

		tracker.track("op-1");

		const tracked = tracker.track("op-1");

		expect(tracked).toBe(false);
	});

	test("tracks multiple different operations", () => {
		const tracker = createOperationTracker();

		expect(tracker.track("op-1")).toBe(true);
		expect(tracker.track("op-2")).toBe(true);
		expect(tracker.track("op-3")).toBe(true);
		expect(tracker.size()).toBe(3);
	});

	test("isTracked returns false for unknown operation", () => {
		const tracker = createOperationTracker();

		expect(tracker.isTracked("unknown")).toBe(false);
	});

	test("getEntry returns operation entry with timestamp", () => {
		const tracker = createOperationTracker();
		const before = Date.now();

		tracker.track("op-1", "hash-123");
		const after = Date.now();

		const entry = tracker.getEntry("op-1");

		expect(entry).not.toBeNull();
		expect(entry?.operationId).toBe("op-1");
		expect(entry?.contentHash).toBe("hash-123");
		expect(entry?.timestamp).toBeGreaterThanOrEqual(before);
		expect(entry?.timestamp).toBeLessThanOrEqual(after);
	});

	test("getEntry returns null for unknown operation", () => {
		const tracker = createOperationTracker();

		expect(tracker.getEntry("unknown")).toBeNull();
	});

	test("clear removes all tracked operations", () => {
		const tracker = createOperationTracker();

		tracker.track("op-1");
		tracker.track("op-2");

		tracker.clear();

		expect(tracker.size()).toBe(0);
		expect(tracker.isTracked("op-1")).toBe(false);
	});

	test("clearStale removes old operations", async () => {
		const tracker = createOperationTracker();

		tracker.track("op-1");

		await new Promise((resolve) => setTimeout(resolve, 50));
		tracker.track("op-2");

		const cleared = tracker.clearStale(25);

		expect(cleared).toBe(1);
		expect(tracker.isTracked("op-1")).toBe(false);
		expect(tracker.isTracked("op-2")).toBe(true);
	});

	test("size returns correct count", () => {
		const tracker = createOperationTracker();

		expect(tracker.size()).toBe(0);

		tracker.track("op-1");

		expect(tracker.size()).toBe(1);

		tracker.track("op-2");

		expect(tracker.size()).toBe(2);
	});
});

describe("createOperationId", () => {
	test("joins string parts with colon", () => {
		const id = createOperationId("session", "save", "12345");

		expect(id).toBe("session:save:12345");
	});

	test("includes number parts", () => {
		const id = createOperationId("iteration", 5, "log");

		expect(id).toBe("iteration:5:log");
	});

	test("filters out null values", () => {
		const id = createOperationId("a", null, "b", null, "c");

		expect(id).toBe("a:b:c");
	});

	test("filters out undefined values", () => {
		const id = createOperationId("a", undefined, "b");

		expect(id).toBe("a:b");
	});

	test("handles single part", () => {
		const id = createOperationId("single");

		expect(id).toBe("single");
	});

	test("handles empty call", () => {
		const id = createOperationId();

		expect(id).toBe("");
	});
});

describe("createDebouncedWriter", () => {
	beforeEach(() => {
		ensureTestDir();
	});

	afterEach(() => {
		cleanupTestDir();
	});

	test("schedules write after debounce period", async () => {
		const writer = createDebouncedWriter({ debounceMs: 20 });
		const filePath = join(TEST_DIR, "debounced.txt");

		writer.scheduleWrite(filePath, "content");

		expect(existsSync(filePath)).toBe(false);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, "utf-8")).toBe("content");
	});

	test("debounces multiple writes to same file", async () => {
		const writer = createDebouncedWriter({ debounceMs: 50 });
		const filePath = join(TEST_DIR, "debounced.txt");

		writer.scheduleWrite(filePath, "content 1");
		writer.scheduleWrite(filePath, "content 2");
		writer.scheduleWrite(filePath, "content 3");

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(readFileSync(filePath, "utf-8")).toBe("content 3");
	});

	test("flush immediately writes pending content", () => {
		const writer = createDebouncedWriter({ debounceMs: 1_000 });
		const filePath = join(TEST_DIR, "flushed.txt");

		writer.scheduleWrite(filePath, "content");
		writer.flush();

		expect(existsSync(filePath)).toBe(true);
		expect(readFileSync(filePath, "utf-8")).toBe("content");
	});

	test("cancel removes pending write", async () => {
		const writer = createDebouncedWriter({ debounceMs: 50 });
		const filePath = join(TEST_DIR, "cancelled.txt");

		writer.scheduleWrite(filePath, "content");
		writer.cancel(filePath);

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(existsSync(filePath)).toBe(false);
	});

	test("cancelAll removes all pending writes", async () => {
		const writer = createDebouncedWriter({ debounceMs: 50 });
		const filePath1 = join(TEST_DIR, "cancelled1.txt");
		const filePath2 = join(TEST_DIR, "cancelled2.txt");

		writer.scheduleWrite(filePath1, "content1");
		writer.scheduleWrite(filePath2, "content2");
		writer.cancelAll();

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(existsSync(filePath1)).toBe(false);
		expect(existsSync(filePath2)).toBe(false);
	});

	test("hasPending returns correct status", () => {
		const writer = createDebouncedWriter({ debounceMs: 1_000 });
		const filePath = join(TEST_DIR, "pending.txt");

		expect(writer.hasPending(filePath)).toBe(false);

		writer.scheduleWrite(filePath, "content");

		expect(writer.hasPending(filePath)).toBe(true);

		writer.cancel(filePath);

		expect(writer.hasPending(filePath)).toBe(false);
	});

	test("getPendingCount returns correct count", () => {
		const writer = createDebouncedWriter({ debounceMs: 1_000 });

		expect(writer.getPendingCount()).toBe(0);

		writer.scheduleWrite(join(TEST_DIR, "a.txt"), "a");

		expect(writer.getPendingCount()).toBe(1);

		writer.scheduleWrite(join(TEST_DIR, "b.txt"), "b");

		expect(writer.getPendingCount()).toBe(2);

		writer.cancelAll();

		expect(writer.getPendingCount()).toBe(0);
	});
});

describe("createBatchedUpdater", () => {
	test("batches multiple updates into one save", async () => {
		let loadCount = 0;
		let saveCount = 0;
		let currentValue = 0;

		const updater = createBatchedUpdater({
			debounceMs: 20,
			load: () => {
				loadCount++;

				return currentValue;
			},
			save: (value) => {
				saveCount++;
				currentValue = value;
			},
		});

		updater.update((v) => v + 1);
		updater.update((v) => v + 1);
		updater.update((v) => v + 1);

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(currentValue).toBe(3);
		expect(loadCount).toBe(1);
		expect(saveCount).toBe(1);
	});

	test("flush immediately applies pending updates", () => {
		let currentValue = 0;

		const updater = createBatchedUpdater({
			debounceMs: 1_000,
			load: () => currentValue,
			save: (value) => {
				currentValue = value;
			},
		});

		updater.update((v) => v + 5);
		updater.update((v) => v * 2);

		expect(currentValue).toBe(0);

		updater.flush();

		expect(currentValue).toBe(10);
	});

	test("cancel discards pending updates", async () => {
		let currentValue = 0;

		const updater = createBatchedUpdater({
			debounceMs: 50,
			load: () => currentValue,
			save: (value) => {
				currentValue = value;
			},
		});

		updater.update((v) => v + 100);
		updater.cancel();

		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(currentValue).toBe(0);
	});

	test("hasPending returns correct status", () => {
		const updater = createBatchedUpdater({
			debounceMs: 1_000,
			load: () => 0,
			save: () => {},
		});

		expect(updater.hasPending()).toBe(false);

		updater.update((v) => v + 1);

		expect(updater.hasPending()).toBe(true);

		updater.flush();

		expect(updater.hasPending()).toBe(false);
	});

	test("applies updates in order", () => {
		const operations: string[] = [];
		let currentValue = "";

		const updater = createBatchedUpdater({
			debounceMs: 0,
			load: () => currentValue,
			save: (value) => {
				currentValue = value;
			},
		});

		updater.update((v) => {
			operations.push("first");

			return `${v}A`;
		});
		updater.update((v) => {
			operations.push("second");

			return `${v}B`;
		});
		updater.update((v) => {
			operations.push("third");

			return `${v}C`;
		});

		updater.flush();

		expect(currentValue).toBe("ABC");
		expect(operations).toEqual(["first", "second", "third"]);
	});
});
