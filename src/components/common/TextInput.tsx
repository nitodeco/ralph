import chalk from "chalk";
import { Box, Text, useInput } from "ink";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVimMode, type VimMode } from "@/lib/vim/index.ts";

interface InputState {
	readonly value: string;
	readonly cursorOffset: number;
	readonly cursorWidth: number;
}

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

function isWordCharacter(char: string): boolean {
	return /\w/.test(char);
}

function getPreviousWordBoundary(text: string, cursorOffset: number): number {
	if (cursorOffset <= 0) {
		return 0;
	}

	let position = cursorOffset - 1;

	while (position > 0 && !isWordCharacter(text[position - 1] ?? "")) {
		position--;
	}

	while (position > 0 && isWordCharacter(text[position - 1] ?? "")) {
		position--;
	}

	return position;
}

function getNextWordBoundary(text: string, cursorOffset: number): number {
	const textLength = text.length;

	if (cursorOffset >= textLength) {
		return textLength;
	}

	let position = cursorOffset;

	while (position < textLength && !isWordCharacter(text[position] ?? "")) {
		position++;
	}

	while (position < textLength && isWordCharacter(text[position] ?? "")) {
		position++;
	}

	return position;
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
	readonly onShiftTab?: () => void;
	readonly onArrowRight?: () => void;
	readonly onQuit?: () => void;
	readonly onEscape?: () => void;
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
	onShiftTab,
	onArrowRight,
	onQuit,
	onEscape,
	vimMode: isVimModeEnabled = false,
	showVimModeIndicator = true,
	onVimModeChange,
}: TextInputProps): React.ReactElement {
	const stateRef = useRef<InputState>({
		value: originalValue || "",
		cursorOffset: (originalValue || "").length,
		cursorWidth: 0,
	});

	const [renderState, setRenderState] = useState({
		cursorOffset: (originalValue || "").length,
		cursorWidth: 0,
	});

	const inputQueueRef = useRef<Array<{ input: string; key: unknown }>>([]);
	const isProcessingRef = useRef(false);
	const pendingOnChangeRef = useRef<string | null>(null);

	const { cursorOffset, cursorWidth } = renderState;

	const vimModeRef = useRef<VimMode>("insert");

	const syncStateToRender = useCallback(() => {
		const currentState = stateRef.current;

		setRenderState({
			cursorOffset: currentState.cursorOffset,
			cursorWidth: currentState.cursorWidth,
		});

		if (pendingOnChangeRef.current !== null && pendingOnChangeRef.current !== originalValue) {
			const valueToEmit = pendingOnChangeRef.current;

			pendingOnChangeRef.current = null;
			onChange(valueToEmit);
		}
	}, [onChange, originalValue]);

	const handleCursorChange = useCallback(
		(offset: number) => {
			stateRef.current = {
				...stateRef.current,
				cursorOffset: offset,
			};
			syncStateToRender();
		},
		[syncStateToRender],
	);

	const {
		mode: vimCurrentMode,
		pendingOperator,
		handleInput: handleVimInput,
	} = useVimMode({
		value: stateRef.current.value,
		cursorOffset: stateRef.current.cursorOffset,
		onChange: (newValue: string) => {
			stateRef.current = {
				...stateRef.current,
				value: newValue,
			};
			pendingOnChangeRef.current = newValue;
			syncStateToRender();
		},
		onCursorChange: handleCursorChange,
		enabled: isVimModeEnabled,
	});

	useEffect(() => {
		vimModeRef.current = vimCurrentMode;
	}, [vimCurrentMode]);

	useEffect(() => {
		onVimModeChange?.(vimCurrentMode);
	}, [vimCurrentMode, onVimModeChange]);

	useEffect(() => {
		if (pendingOnChangeRef.current !== null) {
			return;
		}

		const currentInternalValue = stateRef.current.value;

		if (originalValue !== currentInternalValue) {
			stateRef.current = {
				...stateRef.current,
				value: originalValue,
				cursorOffset: originalValue.length,
			};
			syncStateToRender();
		}
	}, [originalValue, syncStateToRender]);

	useEffect(() => {
		if (!focus || !showCursor) {
			return;
		}

		const newValue = originalValue || "";

		if (stateRef.current.cursorOffset > newValue.length) {
			stateRef.current = {
				...stateRef.current,
				cursorOffset: newValue.length,
				cursorWidth: 0,
			};
			syncStateToRender();
		}
	}, [originalValue, focus, showCursor, syncStateToRender]);

	const cursorActualWidth = highlightPastedText ? cursorWidth : 0;
	const value = mask ? mask.repeat(originalValue.length) : originalValue;
	const isNormalMode = isVimModeEnabled && vimCurrentMode === "normal";
	let renderedValue = value;
	let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

	if (showCursor && focus) {
		renderedPlaceholder =
			placeholder.length > 0
				? chalk.inverse(placeholder.at(0)) + chalk.grey(placeholder.slice(1))
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

	const processInputQueue = useCallback(() => {
		if (isProcessingRef.current || inputQueueRef.current.length === 0) {
			return;
		}

		isProcessingRef.current = true;

		const eventsToProcess = [...inputQueueRef.current];

		inputQueueRef.current = [];

		for (const event of eventsToProcess) {
			const { input, key } = event as {
				input: string;
				key: {
					upArrow: boolean;
					downArrow: boolean;
					leftArrow: boolean;
					rightArrow: boolean;
					ctrl: boolean;
					shift: boolean;
					meta: boolean;
					home: boolean;
					end: boolean;
					tab: boolean;
					backspace: boolean;
					delete: boolean;
					return: boolean;
					escape: boolean;
				};
			};

			const isEscape = key.escape;

			if (isVimModeEnabled && isEscape) {
				handleVimInput("", true);
				continue;
			}

			if (!isVimModeEnabled && isEscape && onEscape) {
				onEscape();
				continue;
			}

			const currentState = stateRef.current;
			const currentValue = currentState.value;
			const currentCursorOffset = currentState.cursorOffset;

			if (key.upArrow) {
				const lineCount = getLineCount(currentValue);

				if (lineCount > 1) {
					const { lineIndex, columnIndex } = getLinePosition(currentValue, currentCursorOffset);

					if (lineIndex > 0) {
						const newOffset = getCursorOffsetFromLinePosition(
							currentValue,
							lineIndex - 1,
							columnIndex,
						);

						stateRef.current = {
							...currentState,
							cursorOffset: newOffset,
							cursorWidth: 0,
						};
						continue;
					}
				}

				onArrowUp?.();
				continue;
			}

			if (key.downArrow) {
				const lineCount = getLineCount(currentValue);

				if (lineCount > 1) {
					const { lineIndex, columnIndex } = getLinePosition(currentValue, currentCursorOffset);

					if (lineIndex < lineCount - 1) {
						const newOffset = getCursorOffsetFromLinePosition(
							currentValue,
							lineIndex + 1,
							columnIndex,
						);

						stateRef.current = {
							...currentState,
							cursorOffset: newOffset,
							cursorWidth: 0,
						};
						continue;
					}
				}

				onArrowDown?.();
				continue;
			}

			if (key.ctrl && key.home) {
				stateRef.current = {
					...currentState,
					cursorOffset: 0,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.ctrl && key.end) {
				stateRef.current = {
					...currentState,
					cursorOffset: currentValue.length,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.home) {
				const { lineIndex } = getLinePosition(currentValue, currentCursorOffset);
				const newOffset = getCursorOffsetFromLinePosition(currentValue, lineIndex, 0);

				stateRef.current = {
					...currentState,
					cursorOffset: newOffset,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.end) {
				const { lineIndex } = getLinePosition(currentValue, currentCursorOffset);
				const lineLength = getLineLength(currentValue, lineIndex);
				const newOffset = getCursorOffsetFromLinePosition(currentValue, lineIndex, lineLength);

				stateRef.current = {
					...currentState,
					cursorOffset: newOffset,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.ctrl && key.leftArrow) {
				const newOffset = getPreviousWordBoundary(currentValue, currentCursorOffset);

				stateRef.current = {
					...currentState,
					cursorOffset: newOffset,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.ctrl && key.rightArrow) {
				const newOffset = getNextWordBoundary(currentValue, currentCursorOffset);

				stateRef.current = {
					...currentState,
					cursorOffset: newOffset,
					cursorWidth: 0,
				};
				continue;
			}

			if (key.shift && key.tab) {
				onShiftTab?.();
				continue;
			}

			if (key.tab) {
				onTab?.();
				continue;
			}

			if (key.ctrl && input === "c") {
				continue;
			}

			if (key.return) {
				if (key.ctrl || key.meta) {
					continue;
				}

				if (onSubmit) {
					onSubmit(currentValue);
				}

				continue;
			}

			if (
				isVimModeEnabled &&
				vimModeRef.current === "normal" &&
				!key.leftArrow &&
				!key.rightArrow &&
				!key.backspace &&
				!key.delete
			) {
				if (input === "q" && onQuit) {
					onQuit();
					continue;
				}

				const wasHandled = handleVimInput(input, false);

				if (wasHandled) {
					continue;
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
					continue;
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

			stateRef.current = {
				value: nextValue,
				cursorOffset: nextCursorOffset,
				cursorWidth: nextCursorWidth,
			};

			if (nextValue !== currentValue) {
				pendingOnChangeRef.current = nextValue;
			}
		}

		isProcessingRef.current = false;
		syncStateToRender();
	}, [
		isVimModeEnabled,
		handleVimInput,
		onArrowUp,
		onArrowDown,
		onShiftTab,
		onTab,
		onSubmit,
		onQuit,
		onEscape,
		onArrowRight,
		showCursor,
		collapsePastedText,
		pastedSegments,
		onPaste,
		syncStateToRender,
	]);

	useInput(
		(input, key) => {
			inputQueueRef.current.push({ input, key });

			queueMicrotask(processInputQueue);
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
