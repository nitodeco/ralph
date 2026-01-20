export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateRetryDelay(baseDelayMs: number, retryCount: number): number {
	return baseDelayMs * 2 ** retryCount;
}

export function createThrottledFunction<T extends (arg: string) => void>(
	func: T,
	limitMs: number,
): { throttled: T; flush: () => void } {
	let lastRun = 0;
	let pendingArg: string | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	const throttled = ((arg: string) => {
		const now = Date.now();

		if (now - lastRun >= limitMs) {
			lastRun = now;
			func(arg);
		} else {
			pendingArg = arg;

			if (!timeoutId) {
				timeoutId = setTimeout(
					() => {
						if (pendingArg !== null) {
							lastRun = Date.now();
							func(pendingArg);
							pendingArg = null;
						}

						timeoutId = null;
					},
					limitMs - (now - lastRun),
				);
			}
		}
	}) as T;

	const flush = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}

		if (pendingArg !== null) {
			func(pendingArg);
			pendingArg = null;
		}
	};

	return { throttled, flush };
}
