import { describe, expect, test } from "bun:test";
import { getModelSelectLimit } from "@/components/views/ModelSelectView.tsx";

describe("getModelSelectLimit", () => {
  test("uses the rows left after the fixed model-view content", () => {
    expect(getModelSelectLimit(24, false)).toBe(15);
  });

  test("reserves a row for an unavailable saved-model warning", () => {
    expect(getModelSelectLimit(24, true)).toBe(14);
  });

  test("always leaves one selectable row in a small terminal", () => {
    expect(getModelSelectLimit(8, true)).toBe(1);
  });
});
