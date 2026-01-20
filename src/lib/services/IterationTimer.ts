class IterationTimerClass {
	private delayTimeout: ReturnType<typeof setTimeout> | null = null;
	private projectComplete = false;

	scheduleNext(delayMs: number, callback: () => void): void {
		this.clearDelayTimeout();
		this.delayTimeout = setTimeout(callback, delayMs);
	}

	clearDelayTimeout(): void {
		if (this.delayTimeout) {
			clearTimeout(this.delayTimeout);
			this.delayTimeout = null;
		}
	}

	cancel(): void {
		this.clearDelayTimeout();
	}

	setProjectComplete(value: boolean): void {
		this.projectComplete = value;
	}

	isProjectComplete(): boolean {
		return this.projectComplete;
	}

	reset(): void {
		this.clearDelayTimeout();
		this.projectComplete = false;
	}
}

export const IterationTimer = new IterationTimerClass();
