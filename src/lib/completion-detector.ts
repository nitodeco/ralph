export interface CompletionDetector {
	feed: (chunk: string) => void;
	isComplete: () => boolean;
	reset: () => void;
}

export function createCompletionDetector(marker: string): CompletionDetector {
	const markerLength = marker.length;
	const ringBuffer: string[] = [];
	let isFound = false;
	let tailChars = "";

	const feed = (chunk: string): void => {
		if (isFound) {
			return;
		}

		const combined = tailChars + chunk;

		for (const char of combined) {
			ringBuffer.push(char);

			if (ringBuffer.length > markerLength) {
				ringBuffer.shift();
			}

			if (ringBuffer.length === markerLength && ringBuffer.join("") === marker) {
				isFound = true;

				return;
			}
		}

		tailChars = combined.slice(-(markerLength - 1));
	};

	const isComplete = (): boolean => isFound;

	const reset = (): void => {
		ringBuffer.length = 0;
		isFound = false;
		tailChars = "";
	};

	return { feed, isComplete, reset };
}
