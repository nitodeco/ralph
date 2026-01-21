import {
	findFirstNonWhitespace,
	findNextWordStart,
	findPreviousWordStart,
	findWordEnd,
} from "./motions.ts";
import type { VimAction, VimState } from "./types.ts";

interface ActionContext {
	readonly value: string;
	readonly cursorOffset: number;
	readonly state: VimState;
}

function createNoopAction(): VimAction {
	return { type: "noop" };
}

function createMoveAction(newCursorOffset: number): VimAction {
	return { type: "cursor_move", newCursorOffset };
}

function createDeleteAction(newValue: string, newCursorOffset: number): VimAction {
	return {
		type: "delete",
		newValue,
		newCursorOffset,
		shouldRecordUndo: true,
	};
}

function handleMotion(input: string, context: ActionContext): VimAction | null {
	const { value, cursorOffset } = context;

	switch (input) {
		case "h":
			return createMoveAction(Math.max(0, cursorOffset - 1));

		case "l":
			return createMoveAction(Math.min(value.length - 1, cursorOffset + 1));

		case "w":
			return createMoveAction(findNextWordStart(value, cursorOffset));

		case "b":
			return createMoveAction(findPreviousWordStart(value, cursorOffset));

		case "e":
			return createMoveAction(findWordEnd(value, cursorOffset));

		case "0":
			return createMoveAction(0);

		case "$":
			return createMoveAction(Math.max(0, value.length - 1));

		case "^":
			return createMoveAction(findFirstNonWhitespace(value));

		default:
			return null;
	}
}

function handleDeleteWithMotion(motion: string, context: ActionContext): VimAction {
	const { value, cursorOffset } = context;

	switch (motion) {
		case "w": {
			const endPosition = findNextWordStart(value, cursorOffset);
			const newValue = value.slice(0, cursorOffset) + value.slice(endPosition);
			const newCursorOffset = Math.min(cursorOffset, Math.max(0, newValue.length - 1));

			return createDeleteAction(newValue, newCursorOffset);
		}

		case "b": {
			const startPosition = findPreviousWordStart(value, cursorOffset);
			const newValue = value.slice(0, startPosition) + value.slice(cursorOffset);

			return createDeleteAction(newValue, startPosition);
		}

		case "e": {
			const endPosition = findWordEnd(value, cursorOffset) + 1;
			const newValue = value.slice(0, cursorOffset) + value.slice(endPosition);
			const newCursorOffset = Math.min(cursorOffset, Math.max(0, newValue.length - 1));

			return createDeleteAction(newValue, newCursorOffset);
		}

		case "0": {
			const newValue = value.slice(cursorOffset);

			return createDeleteAction(newValue, 0);
		}

		case "$": {
			const newValue = value.slice(0, cursorOffset);
			const newCursorOffset = Math.max(0, newValue.length - 1);

			return createDeleteAction(newValue, newCursorOffset);
		}

		case "d": {
			return createDeleteAction("", 0);
		}

		default:
			return createNoopAction();
	}
}

export function processNormalModeInput(input: string, context: ActionContext): VimAction {
	const { value, cursorOffset, state } = context;

	if (state.pendingOperator === "d") {
		return handleDeleteWithMotion(input, context);
	}

	const motionAction = handleMotion(input, context);

	if (motionAction) {
		return motionAction;
	}

	switch (input) {
		case "i":
			return { type: "mode_change", newMode: "insert" };

		case "a":
			return {
				type: "mode_change",
				newMode: "insert",
				newCursorOffset: Math.min(cursorOffset + 1, value.length),
			};

		case "A":
			return {
				type: "mode_change",
				newMode: "insert",
				newCursorOffset: value.length,
			};

		case "I":
			return {
				type: "mode_change",
				newMode: "insert",
				newCursorOffset: findFirstNonWhitespace(value),
			};

		case "x":
			if (value.length === 0) {
				return createNoopAction();
			}

			return createDeleteAction(
				value.slice(0, cursorOffset) + value.slice(cursorOffset + 1),
				Math.min(cursorOffset, Math.max(0, value.length - 2)),
			);

		case "X":
			if (cursorOffset === 0) {
				return createNoopAction();
			}

			return createDeleteAction(
				value.slice(0, cursorOffset - 1) + value.slice(cursorOffset),
				cursorOffset - 1,
			);

		case "d":
			return { type: "noop" };

		case "D":
			return handleDeleteWithMotion("$", context);

		case "C":
			return {
				type: "delete",
				newValue: value.slice(0, cursorOffset),
				newCursorOffset: cursorOffset,
				newMode: "insert",
				shouldRecordUndo: true,
			};

		case "u":
			return { type: "undo" };

		default:
			return createNoopAction();
	}
}

export function isPendingOperator(input: string): boolean {
	return input === "d";
}
