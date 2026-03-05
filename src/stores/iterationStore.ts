import { create } from "zustand";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { IterationTimer } from "@/lib/services/index.ts";

interface IterationState {
  current: number;
  total: number;
  isRunning: boolean;
  isDelaying: boolean;
  isPaused: boolean;
  isFullMode: boolean;
}

interface IterationCallbacks {
  onIterationStart?: (iteration: number) => void;
  onIterationComplete?: (iteration: number) => void;
  onAllComplete?: () => void;
  onMaxIterations?: () => void;
  onMaxRuntime?: () => void;
}

interface IterationActions {
  start: () => void;
  startFromIteration: (iteration: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  setTotal: (newTotal: number) => void;
  setFullMode: (isFullMode: boolean) => void;
  markIterationComplete: (isProjectComplete: boolean, hasPendingTasks?: boolean) => void;
  restartCurrentIteration: () => void;
  setCallbacks: (callbacks: IterationCallbacks) => void;
  clearCallbacks: () => void;
  setDelayMs: (delayMs: number) => void;
  setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => void;
  setStartTime: (startTime: number) => void;
  getTimeRemaining: () => number | null;
  isMaxRuntimeReached: () => boolean;
  reset: () => void;
}

type IterationStore = IterationState &
  IterationActions & {
    callbacks: IterationCallbacks;
    delayMs: number;
    maxRuntimeMs: number | undefined;
    startTime: number | null;
  };

const INITIAL_STATE: IterationState = {
  current: 0,
  isDelaying: false,
  isFullMode: false,
  isPaused: false,
  isRunning: false,
  total: 10,
};

export const useIterationStore = create<IterationStore>((set, get) => ({
  ...INITIAL_STATE,
  callbacks: {},
  clearCallbacks: () => {
    set({ callbacks: {} });
  },
  delayMs: DEFAULTS.iterationDelayMs,
  getTimeRemaining: () => {
    const state = get();

    if (!state.maxRuntimeMs || !state.startTime) {
      return null;
    }

    const elapsed = Date.now() - state.startTime;
    const remaining = state.maxRuntimeMs - elapsed;

    return remaining > 0 ? remaining : 0;
  },

  isMaxRuntimeReached: () => {
    const state = get();

    if (!state.maxRuntimeMs || !state.startTime) {
      return false;
    }

    const elapsed = Date.now() - state.startTime;

    return elapsed >= state.maxRuntimeMs;
  },

  markIterationComplete: (isProjectComplete: boolean, hasPendingTasks?: boolean) => {
    const state = get();

    IterationTimer.setProjectComplete(isProjectComplete);
    state.callbacks.onIterationComplete?.(state.current);

    if (isProjectComplete) {
      state.callbacks.onAllComplete?.();

      set({
        isDelaying: false,
        isRunning: false,
      });

      return;
    }

    if (state.current >= state.total) {
      if (state.isFullMode && hasPendingTasks) {
        set({ isDelaying: true, total: state.total + 1 });

        IterationTimer.scheduleNext(state.delayMs, () => {
          get().next();
        });

        return;
      }

      state.callbacks.onMaxIterations?.();
      set({
        isDelaying: false,
        isRunning: false,
      });

      return;
    }

    set({ isDelaying: true });

    IterationTimer.scheduleNext(state.delayMs, () => {
      get().next();
    });
  },

  maxRuntimeMs: undefined,

  next: () => {
    const state = get();

    if (state.current >= state.total || IterationTimer.isProjectComplete()) {
      state.callbacks.onAllComplete?.();

      set({
        isDelaying: false,
        isRunning: false,
      });

      return;
    }

    if (state.isMaxRuntimeReached()) {
      state.callbacks.onMaxRuntime?.();

      set({
        isDelaying: false,
        isRunning: false,
      });

      return;
    }

    const nextIteration = state.current + 1;

    state.callbacks.onIterationStart?.(nextIteration);

    set({
      current: nextIteration,
      isDelaying: false,
    });
  },

  pause: () => {
    IterationTimer.cancel();
    set({
      isDelaying: false,
      isPaused: true,
    });
  },

  reset: () => {
    IterationTimer.reset();

    set({
      ...INITIAL_STATE,
      callbacks: {},
      delayMs: DEFAULTS.iterationDelayMs,
      maxRuntimeMs: undefined,
      startTime: null,
    });
  },

  restartCurrentIteration: () => {
    const state = get();

    set({ isDelaying: true });

    IterationTimer.scheduleNext(state.delayMs, () => {
      const currentState = get();

      currentState.callbacks.onIterationStart?.(currentState.current);
      set({ isDelaying: false });
    });
  },

  resume: () => {
    set({
      isPaused: false,
    });
  },

  setCallbacks: (callbacks: IterationCallbacks) => {
    set({ callbacks });
  },

  setDelayMs: (delayMs: number) => {
    set({ delayMs });
  },

  setFullMode: (isFullMode: boolean) => {
    set({ isFullMode });
  },

  setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => {
    set({ maxRuntimeMs });
  },

  setStartTime: (startTime: number) => {
    set({ startTime });
  },

  setTotal: (newTotal: number) => {
    set({ total: newTotal });
  },

  start: () => {
    IterationTimer.setProjectComplete(false);
    const state = get();
    const startTime = state.startTime ?? Date.now();

    set({
      current: 1,
      isDelaying: false,
      isPaused: false,
      isRunning: true,
      startTime,
    });
    get().callbacks.onIterationStart?.(1);
  },

  startFromIteration: (iteration: number) => {
    IterationTimer.setProjectComplete(false);
    const state = get();
    const startTime = state.startTime ?? Date.now();

    set({
      current: iteration,
      isDelaying: false,
      isPaused: false,
      isRunning: true,
      startTime,
    });
    get().callbacks.onIterationStart?.(iteration);
  },

  startTime: null,

  stop: () => {
    IterationTimer.cancel();
    set({
      isDelaying: false,
      isPaused: false,
      isRunning: false,
    });
  },
}));
