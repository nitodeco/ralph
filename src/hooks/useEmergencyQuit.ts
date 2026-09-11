import { useInput } from "ink";
import { useRef } from "react";

export const EMERGENCY_QUIT_INTERVAL_MS = 1_000;

export interface EmergencyQuitTransition {
  readonly isQuitRequested: boolean;
  readonly maybeEscapePressedAtMs: number | null;
}

export function getEmergencyQuitTransition(
  maybePreviousEscapePressedAtMs: number | null,
  isEscape: boolean,
  pressedAtMs: number,
): EmergencyQuitTransition {
  if (!isEscape) {
    return {
      isQuitRequested: false,
      maybeEscapePressedAtMs: null,
    };
  }

  const isWithinQuitInterval =
    maybePreviousEscapePressedAtMs !== null &&
    pressedAtMs >= maybePreviousEscapePressedAtMs &&
    pressedAtMs - maybePreviousEscapePressedAtMs <= EMERGENCY_QUIT_INTERVAL_MS;

  return {
    isQuitRequested: isWithinQuitInterval,
    maybeEscapePressedAtMs: isWithinQuitInterval ? null : pressedAtMs,
  };
}

export function useEmergencyQuit(onQuit: () => void): void {
  const maybeEscapePressedAtMsRef = useRef<number | null>(null);

  useInput((input, key) => {
    if (key.eventType === "release") {
      return;
    }

    if (key.ctrl && input === "c") {
      maybeEscapePressedAtMsRef.current = null;
      onQuit();
      return;
    }

    const transition = getEmergencyQuitTransition(
      maybeEscapePressedAtMsRef.current,
      key.escape,
      Date.now(),
    );

    maybeEscapePressedAtMsRef.current = transition.maybeEscapePressedAtMs;

    if (transition.isQuitRequested) {
      onQuit();
    }
  });
}
