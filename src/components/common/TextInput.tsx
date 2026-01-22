import chalk from "chalk";
import { Box, Text, useInput } from "ink";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVimMode, type VimMode } from "@/lib/vim/index.ts";

interface LinePosition {
	readonly lineIndex: number;
	readonly columnIndex: number;
}

function getLinePosition(text: string, cursorOffset: number): LinePosition {
	const lines = text.split("\n");
	let currentOffset = 0;

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex] ?? "";
		const lineEndOffset = currentOffset + line.length;

		if (cursorOffset <= lineEndOffset) {
			return {
				lineIndex,
				columnIndex: cursorOffset - currentOffset,
			};
		}

		currentOffset = lineEndOffset + 1;
	}

	const lastLineIndex = lines.length - 1;
	const lastLine = lines[lastLineIndex] ?? "";

	return {
		lineIndex: lastLineIndex,
		columnIndex: lastLine.length,
	};
}

function getCursorOffsetFromLinePosition(
	text: string,
	lineIndex: number,
	columnIndex: number,
): number {
	const lines = text.split("\n");
	let offset = 0;

	for (let index = 0; index < lineIndex && index < lines.length; index++) {
		const line = lines[index] ?? "";

		offset += line.length + 1;
	}

	const targetLine = lines[lineIndex] ?? "";
	const clampedColumn = Math.min(columnIndex, targetLine.length);

	return offset + clampedColumn;
}

function getLineCount(text: string): number {
	return text.split("\n").length;
}

function getLineLength(text: string, lineIndex: number): number {
	const lines = text.split("\n");
	const line = lines[lineIndex] ?? "";

	return line.length;
}

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
	readonly vimMode?: boolean;
	readonly showVimModeIndicator?: boolean;
	readonly onVimModeChange?: (mode: VimMode) => void;
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
	vimMode: isVimModeEnabled = false,
	showVimModeIndicator = true,
	onVimModeChange,
}: TextInputProps): React.ReactElement {
	const [state, setState] = useState({
		cursorOffset: (originalValue || "").length,
		cursorWidth: 0,
	});

	const { cursorOffset, cursorWidth } = state;

	const valueRef = useRef(originalValue);
	const cursorOffsetRef = useRef(cursorOffset);

	const handleCursorChange = useCallback((offset: number) => {
		cursorOffsetRef.current = offset;
		setState((previousState) => ({
			...previousState,
			cursorOffset: offset,
		}));
	}, []);

	const {
		mode: vimCurrentMode,
		pendingOperator,
		handleInput: handleVimInput,
	} = useVimMode({
		value: originalValue,
		cursorOffset,
		onChange,
		onCursorChange: handleCursorChange,
		enabled: isVimModeEnabled,
	});

	useEffect(() => {
		onVimModeChange?.(vimCurrentMode);
	}, [vimCurrentMode, onVimModeChange]);

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
	const isNormalMode = isVimModeEnabled && vimCurrentMode === "normal";
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
				const isAtCursor = index === cursorOffset;
				const isInHighlightRange =
					index >= cursorOffset - cursorActualWidth && index <= cursorOffset;

				if (isNormalMode && isAtCursor) {
					renderedValue += chalk.bgYellow.black(char);
				} else if (isInHighlightRange) {
					renderedValue += chalk.inverse(char);
				} else {
					renderedValue += char;
				}

				index++;
			}

			if (value.length > 0 && cursorOffset >= value.length) {
				renderedValue += isNormalMode ? chalk.bgYellow.black(" ") : chalk.inverse(" ");
			} else if (value.length === 0) {
				renderedValue = isNormalMode ? chalk.bgYellow.black(" ") : chalk.inverse(" ");
			}
		}
	}

	const vimModeIndicator =
		isVimModeEnabled && showVimModeIndicator ? (
			<Text color={isNormalMode ? "yellow" : "green"}>
				{isNormalMode ? `[N${pendingOperator ? pendingOperator : ""}]` : "[I]"}
			</Text>
		) : null;

	useInput(
		(input, key) => {
			const isEscape = key.escape;

			if (isVimModeEnabled && isEscape) {
				handleVimInput("", true);

				return;
			}

			if (key.upArrow) {
				const currentValue = valueRef.current;
				const currentCursorOffset = cursorOffsetRef.current;
				const lineCount = getLineCount(currentValue);

				if (lineCount > 1) {
					const { lineIndex, columnIndex } = getLinePosition(currentValue, currentCursorOffset);

					if (lineIndex > 0) {
						const newOffset = getCursorOffsetFromLinePosition(
							currentValue,
							lineIndex - 1,
							columnIndex,
						);

						valueRef.current = currentValue;
						cursorOffsetRef.current = newOffset;
						setState({ cursorOffset: newOffset, cursorWidth: 0 });

						return;
					}
				}

				onArrowUp?.();

				return;
			}

			if (key.downArrow) {
				const currentValue = valueRef.current;
				const currentCursorOffset = cursorOffsetRef.current;
				const lineCount = getLineCount(currentValue);

				if (lineCount > 1) {
					const { lineIndex, columnIndex } = getLinePosition(currentValue, currentCursorOffset);

					if (lineIndex < lineCount - 1) {
						const newOffset = getCursorOffsetFromLinePosition(
							currentValue,
							lineIndex + 1,
							columnIndex,
						);

						valueRef.current = currentValue;
						cursorOffsetRef.current = newOffset;
						setState({ cursorOffset: newOffset, cursorWidth: 0 });

						return;
					}
				}

				onArrowDown?.();

				return;
			}

			if (key.home) {
				const currentValue = valueRef.current;
				const currentCursorOffset = cursorOffsetRef.current;
				const { lineIndex } = getLinePosition(currentValue, currentCursorOffset);
				const newOffset = getCursorOffsetFromLinePosition(currentValue, lineIndex, 0);

				valueRef.current = currentValue;
				cursorOffsetRef.current = newOffset;
				setState({ cursorOffset: newOffset, cursorWidth: 0 });

				return;
			}

			if (key.end) {
				const currentValue = valueRef.current;
				const currentCursorOffset = cursorOffsetRef.current;
				const { lineIndex } = getLinePosition(currentValue, currentCursorOffset);
				const lineLength = getLineLength(currentValue, lineIndex);
				const newOffset = getCursorOffsetFromLinePosition(currentValue, lineIndex, lineLength);

				valueRef.current = currentValue;
				cursorOffsetRef.current = newOffset;
				setState({ cursorOffset: newOffset, cursorWidth: 0 });

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

			if (
				isVimModeEnabled &&
				vimCurrentMode === "normal" &&
				!key.leftArrow &&
				!key.rightArrow &&
				!key.backspace &&
				!key.delete
			) {
				const wasHandled = handleVimInput(input, false);

				if (wasHandled) {
					return;
				}
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

	const textContent = placeholder
		? value.length > 0
			? renderedValue
			: renderedPlaceholder
		: renderedValue;

	if (vimModeIndicator) {
		return (
			<Box>
				{vimModeIndicator}
				<Text> </Text>
				<Text>{textContent}</Text>
			</Box>
		);
	}

	return <Text>{textContent}</Text>;
}

export default TextInput;
