import { describe, expect, it } from "bun:test";
import {
	findFirstNonWhitespace,
	findNextWordStart,
	findPreviousWordStart,
	findWordEnd,
} from "@/lib/vim/motions.ts";

describe("vim motions", () => {
	describe("findNextWordStart", () => {
		it("should find next word start from middle of word", () => {
			const result = findNextWordStart("hello world", 2);

			expect(result).toBe(6);
		});

		it("should find next word start from start of word", () => {
			const result = findNextWordStart("hello world", 0);

			expect(result).toBe(6);
		});

		it("should find next word start when on space", () => {
			const result = findNextWordStart("hello world", 5);

			expect(result).toBe(6);
		});

		it("should return end of string when no more words", () => {
			const result = findNextWordStart("hello", 2);

			expect(result).toBe(5);
		});

		it("should handle multiple spaces between words", () => {
			const result = findNextWordStart("hello   world", 0);

			expect(result).toBe(8);
		});

		it("should return length when at end of string", () => {
			const result = findNextWordStart("hello", 4);

			expect(result).toBe(5);
		});
	});

	describe("findPreviousWordStart", () => {
		it("should find previous word start from middle of word", () => {
			const result = findPreviousWordStart("hello world", 8);

			expect(result).toBe(6);
		});

		it("should find previous word start from end of string", () => {
			const result = findPreviousWordStart("hello world", 11);

			expect(result).toBe(6);
		});

		it("should find previous word start when on space", () => {
			const result = findPreviousWordStart("hello world", 5);

			expect(result).toBe(0);
		});

		it("should return 0 when at start of string", () => {
			const result = findPreviousWordStart("hello world", 0);

			expect(result).toBe(0);
		});

		it("should handle multiple spaces between words", () => {
			const result = findPreviousWordStart("hello   world", 10);

			expect(result).toBe(8);
		});
	});

	describe("findWordEnd", () => {
		it("should find word end from middle of word", () => {
			const result = findWordEnd("hello world", 1);

			expect(result).toBe(4);
		});

		it("should find word end from start of word", () => {
			const result = findWordEnd("hello world", 0);

			expect(result).toBe(4);
		});

		it("should find next word end when at current word end", () => {
			const result = findWordEnd("hello world", 4);

			expect(result).toBe(10);
		});

		it("should handle being at end of string", () => {
			const result = findWordEnd("hello", 4);

			expect(result).toBe(4);
		});
	});

	describe("findFirstNonWhitespace", () => {
		it("should return 0 when no leading whitespace", () => {
			const result = findFirstNonWhitespace("hello world");

			expect(result).toBe(0);
		});

		it("should return index of first non-whitespace character", () => {
			const result = findFirstNonWhitespace("   hello world");

			expect(result).toBe(3);
		});

		it("should handle tabs", () => {
			const result = findFirstNonWhitespace("\t\thello world");

			expect(result).toBe(2);
		});

		it("should return 0 for empty string", () => {
			const result = findFirstNonWhitespace("");

			expect(result).toBe(0);
		});

		it("should return 0 for all whitespace string", () => {
			const result = findFirstNonWhitespace("   ");

			expect(result).toBe(0);
		});
	});
});
