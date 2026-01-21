import chalk from "chalk";
import { Text, useInput } from "ink";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export interface PastedTextSegment {
	readonly id: number;
	readonly content: string;
	readonly placeholder: string;
}

const PASTE_THRESHOLD_CHARS = 80;

export function isPasteLongEnough(text: string): boolean {
	return text.includes("\n") || text.length > PASTE_THRESHOLD_CHARS;
}

export function expandPastedSegments(
	displayValue: string,
	segments: readonly PastedTextSegment[],
): string {
	let result = displayValue;

	for (const segment of segments) {
		result = result.replace(segment.placeholder, segment.content);
	}

	return result;
}

export interface TextInputProps {
	readonly placeholder?: string;
	readonly focus?: boolean;
	readonly mask?: string;
	readonly showCursor?: boolean;
	readonly highlightPastedText?: boolean;
	readonly collapsePastedText?: boolean;
	readonly pastedSegments?: readonly PastedTextSegment[];
	readonly onPaste?: (segment: PastedTextSegment) => void;
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onSubmit?: (value: string) => void;
	readonly onArrowUp?: () => void;
	readonly onArrowDown?: () => void;
	readonly onTab?: () => void;
	readonly onArrowRight?: () => void;
}

function renderValueWithPlaceholders(
	value: string,
	pastedSegments: readonly PastedTextSegment[],
	cursorOffset: number,
	cursorActualWidth: number,
): string {
	let result = "";
	let index = 0;

	for (const segment of pastedSegments) {
		const placeholderIndex = value.indexOf(segment.placeholder);

		if (placeholderIndex === -1) {
			continue;
		}

		for (let i = index; i < placeholderIndex; i++) {
			const char = value[i] ?? "";
			const isHighlighted = i >= cursorOffset - cursorActualWidth && i <= cursorOffset;

			result += isHighlighted ? chalk.inverse(char) : char;
		}

		result += chalk.dim.cyan(segment.placeholder);
		index = placeholderIndex + segment.placeholder.length;
	}

	for (let i = index; i < value.length; i++) {
		const char = value[i] ?? "";
		const isHighlighted = i >= cursorOffset - cursorActualWidth && i <= cursorOffset;

		result += isHighlighted ? chalk.inverse(char) : char;
	}

	if (value.length > 0 && cursorOffset === value.length) {
		result += chalk.inverse(" ");
	}

	return result;
}

export function TextInput({
	value: originalValue,
	placeholder = "",
	focus = true,
	mask,
	highlightPastedText = false,
	collapsePastedText = false,
	pastedSegments = [],
	onPaste,
	showCursor = true,
	onChange,
	onSubmit,
	onArrowUp,
	onArrowDown,
	onTab,
	onArrowRight,
}: TextInputProps): React.ReactElement {
	const [state, setState] = useState({
		cursorOffset: (originalValue || "").length,
		cursorWidth: 0,
	});

	const { cursorOffset, cursorWidth } = state;

	const valueRef = useRef(originalValue);
	const cursorOffsetRef = useRef(cursorOffset);

	useEffect(() => {
		valueRef.current = originalValue;
	}, [originalValue]);

	useEffect(() => {
		cursorOffsetRef.current = cursorOffset;
	}, [cursorOffset]);

	useEffect(() => {
		setState((previousState) => {
			if (!focus || !showCursor) {
				return previousState;
			}

			const newValue = originalValue || "";

			if (previousState.cursorOffset > newValue.length - 1) {
				return {
					cursorOffset: newValue.length,
					cursorWidth: 0,
				};
			}

			return previousState;
		});
	}, [originalValue, focus, showCursor]);

	const cursorActualWidth = highlightPastedText ? cursorWidth : 0;
	const value = mask ? mask.repeat(originalValue.length) : originalValue;
	let renderedValue = value;
	let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
				: chalk.inverse(" ");

		if (collapsePastedText && pastedSegments.length > 0) {
			renderedValue =
				value.length > 0
					? renderValueWithPlaceholders(value, pastedSegments, cursorOffset, cursorActualWidth)
					: chalk.inverse(" ");
		} else {
			renderedValue = value.length > 0 ? "" : chalk.inverse(" ");
			let index = 0;

			for (const char of value) {
				renderedValue +=
					index >= cursorOffset - cursorActualWidth && index <= cursorOffset
						? chalk.inverse(char)
						: char;
				index++;
			}

			if (value.length > 0 && cursorOffset === value.length) {
				renderedValue += chalk.inverse(" ");
			}
		}
	}

	useInput(
		(input, key) => {
			if (key.upArrow) {
				onArrowUp?.();

				return;
			}

			if (key.downArrow) {
				onArrowDown?.();

				return;
			}

			if (key.tab || (key.shift && key.tab)) {
				onTab?.();

				return;
			}

			if (key.ctrl && input === "c") {
				return;
			}

			const currentValue = valueRef.current;
			const currentCursorOffset = cursorOffsetRef.current;

			if (key.return) {
				if (key.ctrl || key.meta) {
					return;
				}

				if (onSubmit) {
					onSubmit(currentValue);
				}

				return;
			}

			let nextCursorOffset = currentCursorOffset;
			let nextValue = currentValue;
			let nextCursorWidth = 0;

			if (key.leftArrow) {
				if (showCursor) {
					nextCursorOffset--;
				}
			} else if (key.rightArrow) {
				const isAtEnd = currentCursorOffset >= currentValue.length;

				if (isAtEnd && onArrowRight) {
					onArrowRight();

					return;
				}

				if (showCursor) {
					nextCursorOffset++;
				}
			} else if (key.backspace || key.delete) {
				if (currentCursorOffset > 0) {
					nextValue =
						currentValue.slice(0, currentCursorOffset - 1) +
						currentValue.slice(currentCursorOffset, currentValue.length);
					nextCursorOffset--;
				}
			} else {
				const isPaste = input.length > 1;
				const shouldCollapsePaste = collapsePastedText && isPaste && isPasteLongEnough(input);

				if (shouldCollapsePaste && onPaste) {
					const nextId = pastedSegments.length + 1;
					const placeholderText = `[Pasted text #${nextId}]`;
					const segment: PastedTextSegment = {
						id: nextId,
						content: input,
						placeholder: placeholderText,
					};

					onPaste(segment);

					nextValue =
						currentValue.slice(0, currentCursorOffset) +
						placeholderText +
						currentValue.slice(currentCursorOffset, currentValue.length);
					nextCursorOffset += placeholderText.length;
				} else {
					nextValue =
						currentValue.slice(0, currentCursorOffset) +
						input +
						currentValue.slice(currentCursorOffset, currentValue.length);
					nextCursorOffset += input.length;

					if (isPaste) {
						nextCursorWidth = input.length;
					}
				}
			}

			if (nextCursorOffset < 0) {
				nextCursorOffset = 0;
			}

			if (nextCursorOffset > nextValue.length) {
				nextCursorOffset = nextValue.length;
			}

			valueRef.current = nextValue;
			cursorOffsetRef.current = nextCursorOffset;

			setState({
				cursorOffset: nextCursorOffset,
				cursorWidth: nextCursorWidth,
			});

			if (nextValue !== currentValue) {
				onChange(nextValue);
			}
		},
		{ isActive: focus },
	);

	return (
		<Text>
			{placeholder ? (value.length > 0 ? renderedValue : renderedPlaceholder) : renderedValue}
		</Text>
	);
}

export default TextInput;
