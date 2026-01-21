export type VimMode = "normal" | "insert";

export interface VimState {
	readonly mode: VimMode;
	readonly pendingOperator: string | null;
	readonly undoStack: readonly UndoEntry[];
}

export interface UndoEntry {
	readonly value: string;
	readonly cursorOffset: number;
}

export interface VimAction {
	readonly type: "mode_change" | "cursor_move" | "delete" | "undo" | "insert_char" | "noop";
	readonly newMode?: VimMode;
	readonly newCursorOffset?: number;
	readonly newValue?: string;
	readonly shouldRecordUndo?: boolean;
}
