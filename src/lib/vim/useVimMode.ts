import { useCallback, useState } from "react";
import { match } from "ts-pattern";
import { isPendingOperator, processNormalModeInput } from "./actions.ts";
import type { UndoEntry, VimMode, VimState } from "./types.ts";

const MAX_UNDO_STACK_SIZE = 100;

interface UseVimModeOptions {
	readonly value: string;
	readonly cursorOffset: number;
	readonly onChange: (value: string) => void;
	readonly onCursorChange: (offset: number) => void;
	readonly enabled?: boolean;
}

interface UseVimModeResult {
	readonly mode: VimMode;
	readonly pendingOperator: string | null;
	readonly handleInput: (input: string, isEscape: boolean) => boolean;
	readonly resetToInsert: () => void;
}

export function useVimMode({
	value,
	cursorOffset,
	onChange,
	onCursorChange,
	enabled = true,
}: UseVimModeOptions): UseVimModeResult {
	const [state, setState] = useState<VimState>({
		mode: "insert",
		pendingOperator: null,
		undoStack: [],
	});

	const recordUndo = useCallback(() => {
		setState((previousState) => {
			const newEntry: UndoEntry = { value, cursorOffset };
			const newStack = [...previousState.undoStack, newEntry].slice(-MAX_UNDO_STACK_SIZE);

			return { ...previousState, undoStack: newStack };
		});
	}, [value, cursorOffset]);

	const handleInput = useCallback(
		(input: string, isEscape: boolean): boolean => {
			if (!enabled) {
				return false;
			}

			if (isEscape) {
				setState((previousState) => ({
					...previousState,
					mode: "normal",
					pendingOperator: null,
				}));
				const newCursorOffset = Math.max(0, Math.min(cursorOffset, value.length - 1));

				onCursorChange(newCursorOffset);

				return true;
			}

			if (state.mode === "insert") {
				return false;
			}

			if (state.pendingOperator === null && isPendingOperator(input)) {
				setState((previousState) => ({
					...previousState,
					pendingOperator: input,
				}));

				return true;
			}

			const action = processNormalModeInput(input, {
				value,
				cursorOffset,
				state,
			});

			return match(action.type)
				.with("mode_change", () => {
					setState((previousState) => ({
						...previousState,
						mode: action.newMode ?? previousState.mode,
						pendingOperator: null,
					}));

					if (action.newCursorOffset !== undefined) {
						onCursorChange(action.newCursorOffset);
					}

					return true;
				})
				.with("cursor_move", () => {
					setState((previousState) => ({
						...previousState,
						pendingOperator: null,
					}));

					if (action.newCursorOffset !== undefined) {
						onCursorChange(action.newCursorOffset);
					}

					return true;
				})
				.with("delete", () => {
					if (action.shouldRecordUndo) {
						recordUndo();
					}

					setState((previousState) => ({
						...previousState,
						mode: action.newMode ?? previousState.mode,
						pendingOperator: null,
					}));

					if (action.newValue !== undefined) {
						onChange(action.newValue);
					}

					if (action.newCursorOffset !== undefined) {
						onCursorChange(action.newCursorOffset);
					}

					return true;
				})
				.with("undo", () => {
					const maybeLastEntry = state.undoStack.at(-1);

					if (!maybeLastEntry) {
						return true;
					}

					setState((previousState) => ({
						...previousState,
						undoStack: previousState.undoStack.slice(0, -1),
						pendingOperator: null,
					}));
					onChange(maybeLastEntry.value);
					onCursorChange(maybeLastEntry.cursorOffset);

					return true;
				})
				.with("noop", () => {
					setState((previousState) => ({
						...previousState,
						pendingOperator: null,
					}));

					return true;
				})
				.otherwise(() => false);
		},
		[enabled, state, value, cursorOffset, onChange, onCursorChange, recordUndo],
	);

	const resetToInsert = useCallback(() => {
		setState((previousState) => ({
			...previousState,
			mode: "insert",
			pendingOperator: null,
		}));
	}, []);

	return {
		mode: state.mode,
		pendingOperator: state.pendingOperator,
		handleInput,
		resetToInsert,
	};
}
