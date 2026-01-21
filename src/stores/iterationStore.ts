import { create } from "zustand";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { eventBus } from "@/lib/events.ts";
import { IterationTimer } from "@/lib/services/index.ts";

interface IterationState {
	current: number;
	total: number;
	isRunning: boolean;
	isDelaying: boolean;
	isPaused: boolean;
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
	markIterationComplete: (isProjectComplete: boolean) => void;
	restartCurrentIteration: () => void;
	setCallbacks: (callbacks: IterationCallbacks) => void;
	setDelayMs: (delayMs: number) => void;
	setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => void;
	setStartTime: (startTime: number) => void;
	getTimeRemaining: () => number | null;
	isMaxRuntimeReached: () => boolean;
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
	total: 10,
	isRunning: false,
	isDelaying: false,
	isPaused: false,
};

export const useIterationStore = create<IterationStore>((set, get) => ({
	...INITIAL_STATE,
	callbacks: {},
	delayMs: DEFAULTS.iterationDelayMs,
	maxRuntimeMs: undefined,
	startTime: null,

	setCallbacks: (callbacks: IterationCallbacks) => {
		set({ callbacks });
	},

	setDelayMs: (delayMs: number) => {
		set({ delayMs });
	},

	setMaxRuntimeMs: (maxRuntimeMs: number | undefined) => {
		set({ maxRuntimeMs });
	},

	setStartTime: (startTime: number) => {
		set({ startTime });
	},

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

	start: () => {
		IterationTimer.setProjectComplete(false);
		const state = get();
		const startTime = state.startTime ?? Date.now();

		set({
			current: 1,
			isRunning: true,
			isDelaying: false,
			isPaused: false,
			startTime,
		});
		eventBus.emit("iteration:start", { iteration: 1, totalIterations: state.total });
		get().callbacks.onIterationStart?.(1);
	},

	startFromIteration: (iteration: number) => {
		IterationTimer.setProjectComplete(false);
		const state = get();
		const startTime = state.startTime ?? Date.now();

		set({
			current: iteration,
			isRunning: true,
			isDelaying: false,
			isPaused: false,
			startTime,
		});
		eventBus.emit("iteration:start", { iteration, totalIterations: state.total });
		get().callbacks.onIterationStart?.(iteration);
	},

	pause: () => {
		IterationTimer.cancel();
		set({
			isPaused: true,
			isDelaying: false,
		});
	},

	resume: () => {
		set({
			isPaused: false,
		});
	},

	stop: () => {
		IterationTimer.cancel();
		set({
			isRunning: false,
			isDelaying: false,
			isPaused: false,
		});
	},

	setTotal: (newTotal: number) => {
		set({ total: newTotal });
	},

	next: () => {
		const state = get();

		if (state.current >= state.total || IterationTimer.isProjectComplete()) {
			state.callbacks.onAllComplete?.();

			set({
				isRunning: false,
				isDelaying: false,
			});

			return;
		}

		if (state.isMaxRuntimeReached()) {
			state.callbacks.onMaxRuntime?.();

			set({
				isRunning: false,
				isDelaying: false,
			});

			return;
		}

		const nextIteration = state.current + 1;

		eventBus.emit("iteration:start", { iteration: nextIteration, totalIterations: state.total });
		state.callbacks.onIterationStart?.(nextIteration);

		set({
			current: nextIteration,
			isDelaying: false,
		});
	},

	markIterationComplete: (isProjectComplete: boolean) => {
		const state = get();

		IterationTimer.setProjectComplete(isProjectComplete);
		eventBus.emit("iteration:complete", { iteration: state.current, isProjectComplete });
		state.callbacks.onIterationComplete?.(state.current);

		if (isProjectComplete) {
			state.callbacks.onAllComplete?.();

			set({
				isRunning: false,
				isDelaying: false,
			});

			return;
		}

		if (state.current >= state.total) {
			state.callbacks.onMaxIterations?.();
			set({
				isRunning: false,
				isDelaying: false,
			});

			return;
		}

		set({ isDelaying: true });
		eventBus.emit("iteration:delay", { iteration: state.current, delayMs: state.delayMs });

		IterationTimer.scheduleNext(state.delayMs, () => {
			get().next();
		});
	},

	restartCurrentIteration: () => {
		const state = get();

		set({ isDelaying: true });
		eventBus.emit("iteration:delay", { iteration: state.current, delayMs: state.delayMs });

		IterationTimer.scheduleNext(state.delayMs, () => {
			const currentState = get();

			eventBus.emit("iteration:start", {
				iteration: currentState.current,
				totalIterations: currentState.total,
			});
			currentState.callbacks.onIterationStart?.(currentState.current);
			set({ isDelaying: false });
		});
	},
}));
