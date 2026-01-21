const WORD_BOUNDARY_PATTERN = /\s/;

export function findNextWordStart(text: string, cursorOffset: number): number {
	if (cursorOffset >= text.length - 1) {
		return text.length;
	}

	let position = cursorOffset;

	while (position < text.length && !WORD_BOUNDARY_PATTERN.test(text[position] ?? "")) {
		position++;
	}

	while (position < text.length && WORD_BOUNDARY_PATTERN.test(text[position] ?? "")) {
		position++;
	}

	return position;
}

export function findPreviousWordStart(text: string, cursorOffset: number): number {
	if (cursorOffset <= 0) {
		return 0;
	}

	let position = cursorOffset - 1;

	while (position > 0 && WORD_BOUNDARY_PATTERN.test(text[position] ?? "")) {
		position--;
	}

	while (position > 0 && !WORD_BOUNDARY_PATTERN.test(text[position - 1] ?? "")) {
		position--;
	}

	return position;
}

export function findWordEnd(text: string, cursorOffset: number): number {
	if (cursorOffset >= text.length - 1) {
		return Math.max(0, text.length - 1);
	}

	let position = cursorOffset + 1;

	while (position < text.length && WORD_BOUNDARY_PATTERN.test(text[position] ?? "")) {
		position++;
	}

	while (position < text.length - 1 && !WORD_BOUNDARY_PATTERN.test(text[position + 1] ?? "")) {
		position++;
	}

	return Math.min(position, text.length - 1);
}

export function findFirstNonWhitespace(text: string): number {
	for (let i = 0; i < text.length; i++) {
		if (!WORD_BOUNDARY_PATTERN.test(text[i] ?? "")) {
			return i;
		}
	}

	return 0;
}
