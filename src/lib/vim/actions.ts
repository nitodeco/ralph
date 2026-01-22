import { match } from "ts-pattern";
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

	return match(input)
		.with("h", () => createMoveAction(Math.max(0, cursorOffset - 1)))
		.with("l", () => createMoveAction(Math.min(value.length - 1, cursorOffset + 1)))
		.with("w", () => createMoveAction(findNextWordStart(value, cursorOffset)))
		.with("b", () => createMoveAction(findPreviousWordStart(value, cursorOffset)))
		.with("e", () => createMoveAction(findWordEnd(value, cursorOffset)))
		.with("0", () => createMoveAction(0))
		.with("$", () => createMoveAction(Math.max(0, value.length - 1)))
		.with("^", () => createMoveAction(findFirstNonWhitespace(value)))
		.otherwise(() => null);
}

function handleDeleteWithMotion(motion: string, context: ActionContext): VimAction {
	const { value, cursorOffset } = context;

	return match(motion)
		.with("w", () => {
			const endPosition = findNextWordStart(value, cursorOffset);
			const newValue = value.slice(0, cursorOffset) + value.slice(endPosition);
			const newCursorOffset = Math.min(cursorOffset, Math.max(0, newValue.length - 1));

			return createDeleteAction(newValue, newCursorOffset);
		})
		.with("b", () => {
			const startPosition = findPreviousWordStart(value, cursorOffset);
			const newValue = value.slice(0, startPosition) + value.slice(cursorOffset);

			return createDeleteAction(newValue, startPosition);
		})
		.with("e", () => {
			const endPosition = findWordEnd(value, cursorOffset) + 1;
			const newValue = value.slice(0, cursorOffset) + value.slice(endPosition);
			const newCursorOffset = Math.min(cursorOffset, Math.max(0, newValue.length - 1));

			return createDeleteAction(newValue, newCursorOffset);
		})
		.with("0", () => {
			const newValue = value.slice(cursorOffset);

			return createDeleteAction(newValue, 0);
		})
		.with("$", () => {
			const newValue = value.slice(0, cursorOffset);
			const newCursorOffset = Math.max(0, newValue.length - 1);

			return createDeleteAction(newValue, newCursorOffset);
		})
		.with("d", () => createDeleteAction("", 0))
		.otherwise(() => createNoopAction());
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

	return match(input)
		.with("i", () => ({ type: "mode_change" as const, newMode: "insert" as const }))
		.with("a", () => ({
			type: "mode_change" as const,
			newMode: "insert" as const,
			newCursorOffset: Math.min(cursorOffset + 1, value.length),
		}))
		.with("A", () => ({
			type: "mode_change" as const,
			newMode: "insert" as const,
			newCursorOffset: value.length,
		}))
		.with("I", () => ({
			type: "mode_change" as const,
			newMode: "insert" as const,
			newCursorOffset: findFirstNonWhitespace(value),
		}))
		.with("x", () => {
			if (value.length === 0) {
				return createNoopAction();
			}

			return createDeleteAction(
				value.slice(0, cursorOffset) + value.slice(cursorOffset + 1),
				Math.min(cursorOffset, Math.max(0, value.length - 2)),
			);
		})
		.with("X", () => {
			if (cursorOffset === 0) {
				return createNoopAction();
			}

			return createDeleteAction(
				value.slice(0, cursorOffset - 1) + value.slice(cursorOffset),
				cursorOffset - 1,
			);
		})
		.with("d", () => ({ type: "noop" as const }))
		.with("D", () => handleDeleteWithMotion("$", context))
		.with("C", () => ({
			type: "delete" as const,
			newValue: value.slice(0, cursorOffset),
			newCursorOffset: cursorOffset,
			newMode: "insert" as const,
			shouldRecordUndo: true,
		}))
		.with("u", () => ({ type: "undo" as const }))
		.otherwise(() => createNoopAction());
}

export function isPendingOperator(input: string): boolean {
	return input === "d";
}
