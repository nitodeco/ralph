import { create } from "zustand";
import { DEFAULTS } from "@/lib/defaults.ts";

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
}

interface IterationActions {
	start: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	next: () => void;
	setTotal: (newTotal: number) => void;
	markIterationComplete: (isProjectComplete: boolean) => void;
	setCallbacks: (callbacks: IterationCallbacks) => void;
	setDelayMs: (delayMs: number) => void;
}

type IterationStore = IterationState &
	IterationActions & { callbacks: IterationCallbacks; delayMs: number };

const INITIAL_STATE: IterationState = {
	current: 0,
	total: 10,
	isRunning: false,
	isDelaying: false,
	isPaused: false,
};

let delayTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let projectCompleteRef = false;

function clearDelayTimeout() {
	if (delayTimeoutRef) {
		clearTimeout(delayTimeoutRef);
		delayTimeoutRef = null;
	}
}

export const useIterationStore = create<IterationStore>((set, get) => ({
	...INITIAL_STATE,
	callbacks: {},
	delayMs: DEFAULTS.iterationDelayMs,

	setCallbacks: (callbacks: IterationCallbacks) => {
		set({ callbacks });
	},

	setDelayMs: (delayMs: number) => {
		set({ delayMs });
	},

	start: () => {
		projectCompleteRef = false;
		set({
			current: 1,
			isRunning: true,
			isDelaying: false,
			isPaused: false,
		});
		get().callbacks.onIterationStart?.(1);
	},

	pause: () => {
		clearDelayTimeout();
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
		clearDelayTimeout();
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
		if (state.current >= state.total || projectCompleteRef) {
			state.callbacks.onAllComplete?.();
			set({
				isRunning: false,
				isDelaying: false,
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

	markIterationComplete: (isProjectComplete: boolean) => {
		const state = get();
		projectCompleteRef = isProjectComplete;
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

		delayTimeoutRef = setTimeout(() => {
			get().next();
		}, state.delayMs);
	},
}));
