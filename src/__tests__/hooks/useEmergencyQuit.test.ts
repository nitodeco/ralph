import { describe, expect, test } from "bun:test";
import {
  EMERGENCY_QUIT_INTERVAL_MS,
  getEmergencyQuitTransition,
} from "@/hooks/useEmergencyQuit.ts";

describe("getEmergencyQuitTransition", () => {
  test("requests quit for two Escape presses inside the interval", () => {
    expect(getEmergencyQuitTransition(1_000, true, 1_000 + EMERGENCY_QUIT_INTERVAL_MS)).toEqual({
      isQuitRequested: true,
      maybeEscapePressedAtMs: null,
    });
  });

  test("starts a new sequence after the interval expires", () => {
    const pressedAtMs = 1_000 + EMERGENCY_QUIT_INTERVAL_MS + 1;

    expect(getEmergencyQuitTransition(1_000, true, pressedAtMs)).toEqual({
      isQuitRequested: false,
      maybeEscapePressedAtMs: pressedAtMs,
    });
  });

  test("resets the sequence when another key is pressed", () => {
    expect(getEmergencyQuitTransition(1_000, false, 1_100)).toEqual({
      isQuitRequested: false,
      maybeEscapePressedAtMs: null,
    });
  });

  test("starts a new sequence if the clock moves backwards", () => {
    expect(getEmergencyQuitTransition(1_000, true, 900)).toEqual({
      isQuitRequested: false,
      maybeEscapePressedAtMs: 900,
    });
  });
});
