import { describe, expect, test } from "bun:test";
import {
  type PastedTextSegment,
  expandPastedSegments,
  isPasteLongEnough,
} from "@/components/common/TextInput.tsx";

describe("isPasteLongEnough", () => {
  test("returns true for text with newlines", () => {
    const text = "line1\nline2";

    expect(isPasteLongEnough(text)).toBe(true);
  });

  test("returns true for text exceeding 80 characters", () => {
    const text = "a".repeat(81);

    expect(isPasteLongEnough(text)).toBe(true);
  });

  test("returns false for short text without newlines", () => {
    const text = "short text";

    expect(isPasteLongEnough(text)).toBe(false);
  });

  test("returns false for exactly 80 characters", () => {
    const text = "a".repeat(80);

    expect(isPasteLongEnough(text)).toBe(false);
  });

  test("returns true for single character with newline", () => {
    const text = "a\n";

    expect(isPasteLongEnough(text)).toBe(true);
  });

  test("returns false for empty string", () => {
    expect(isPasteLongEnough("")).toBe(false);
  });
});

describe("expandPastedSegments", () => {
  test("expands single placeholder", () => {
    const segments: PastedTextSegment[] = [
      { content: "actual content here", id: 1, placeholder: "[Pasted text #1]" },
    ];
    const displayValue = "prefix [Pasted text #1] suffix";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("prefix actual content here suffix");
  });

  test("expands multiple placeholders in order", () => {
    const segments: PastedTextSegment[] = [
      { content: "first paste", id: 1, placeholder: "[Pasted text #1]" },
      { content: "second paste", id: 2, placeholder: "[Pasted text #2]" },
    ];
    const displayValue = "[Pasted text #1] and [Pasted text #2]";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("first paste and second paste");
  });

  test("returns original value when no segments", () => {
    const displayValue = "no placeholders here";

    const result = expandPastedSegments(displayValue, []);

    expect(result).toBe("no placeholders here");
  });

  test("handles segments with multiline content", () => {
    const segments: PastedTextSegment[] = [
      { content: "line1\nline2\nline3", id: 1, placeholder: "[Pasted text #1]" },
    ];
    const displayValue = "[Pasted text #1]";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("line1\nline2\nline3");
  });

  test("handles segments with special characters", () => {
    const segments: PastedTextSegment[] = [
      {
        content: "const foo = { bar: 'baz' };",
        id: 1,
        placeholder: "[Pasted text #1]",
      },
    ];
    const displayValue = "code: [Pasted text #1]";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("code: const foo = { bar: 'baz' };");
  });

  test("ignores segments not in display value", () => {
    const segments: PastedTextSegment[] = [
      { content: "content", id: 1, placeholder: "[Pasted text #1]" },
    ];
    const displayValue = "no placeholder here";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("no placeholder here");
  });

  test("handles mixed case with some segments present", () => {
    const segments: PastedTextSegment[] = [
      { content: "first", id: 1, placeholder: "[Pasted text #1]" },
      { content: "second", id: 2, placeholder: "[Pasted text #2]" },
    ];
    const displayValue = "only [Pasted text #2] here";

    const result = expandPastedSegments(displayValue, segments);

    expect(result).toBe("only second here");
  });
});
