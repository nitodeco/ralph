import { useCallback, useEffect, useRef, useState } from "react";

interface UseIterationState {
	current: number;
	total: number;
	isRunning: boolean;
	isDelaying: boolean;
	isPaused: boolean;
}

interface UseIterationOptions {
	total: number;
	delayMs?: number;
	onIterationStart?: (iteration: number) => void;
	onIterationComplete?: (iteration: number) => void;
	onAllComplete?: () => void;
}

interface UseIterationReturn extends UseIterationState {
	start: () => void;
	pause: () => void;
	resume: () => void;
	stop: () => void;
	next: () => void;
	setTotal: (newTotal: number) => void;
	markIterationComplete: (isProjectComplete: boolean) => void;
}

const DEFAULT_DELAY_MS = 2000;

export function useIteration(options: UseIterationOptions): UseIterationReturn {
	const {
		total,
		delayMs = DEFAULT_DELAY_MS,
		onIterationStart,
		onIterationComplete,
		onAllComplete,
	} = options;

	const [state, setState] = useState<UseIterationState>({
		current: 0,
		total,
		isRunning: false,
		isDelaying: false,
		isPaused: false,
	});

	const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const projectCompleteRef = useRef(false);

	const clearDelayTimeout = useCallback(() => {
		if (delayTimeoutRef.current) {
			clearTimeout(delayTimeoutRef.current);
			delayTimeoutRef.current = null;
		}
	}, []);

	const start = useCallback(() => {
		projectCompleteRef.current = false;
		setState((prev) => ({
			...prev,
			current: 1,
			isRunning: true,
			isDelaying: false,
			isPaused: false,
		}));
		onIterationStart?.(1);
	}, [onIterationStart]);

	const pause = useCallback(() => {
		clearDelayTimeout();
		setState((prev) => ({
			...prev,
			isPaused: true,
			isDelaying: false,
		}));
	}, [clearDelayTimeout]);

	const resume = useCallback(() => {
		setState((prev) => ({
			...prev,
			isPaused: false,
		}));
	}, []);

	const stop = useCallback(() => {
		clearDelayTimeout();
		setState((prev) => ({
			...prev,
			isRunning: false,
			isDelaying: false,
			isPaused: false,
		}));
	}, [clearDelayTimeout]);

	const setTotal = useCallback((newTotal: number) => {
		setState((prev) => ({
			...prev,
			total: newTotal,
		}));
	}, []);

	const next = useCallback(() => {
		setState((prev) => {
			if (prev.current >= prev.total || projectCompleteRef.current) {
				onAllComplete?.();
				return {
					...prev,
					isRunning: false,
					isDelaying: false,
				};
			}

			const nextIteration = prev.current + 1;
			onIterationStart?.(nextIteration);

			return {
				...prev,
				current: nextIteration,
				isDelaying: false,
			};
		});
	}, [onIterationStart, onAllComplete]);

	const markIterationComplete = useCallback(
		(isProjectComplete: boolean) => {
			projectCompleteRef.current = isProjectComplete;
			onIterationComplete?.(state.current);

			if (isProjectComplete) {
				onAllComplete?.();
				setState((prev) => ({
					...prev,
					isRunning: false,
					isDelaying: false,
				}));
				return;
			}

			if (state.current >= total) {
				stop();
				return;
			}

			setState((prev) => ({
				...prev,
				isDelaying: true,
			}));

			delayTimeoutRef.current = setTimeout(() => {
				next();
			}, delayMs);
		},
		[state.current, total, delayMs, onIterationComplete, onAllComplete, stop, next],
	);

	useEffect(() => {
		return () => {
			clearDelayTimeout();
		};
	}, [clearDelayTimeout]);

	return {
		...state,
		start,
		pause,
		resume,
		stop,
		next,
		setTotal,
		markIterationComplete,
	};
}
