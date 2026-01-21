import { describe, expect, it } from "bun:test";
import { isPendingOperator, processNormalModeInput } from "@/lib/vim/actions.ts";
import type { VimState } from "@/lib/vim/types.ts";

describe("vim actions", () => {
	const createState = (overrides: Partial<VimState> = {}): VimState => ({
		mode: "normal",
		pendingOperator: null,
		undoStack: [],
		...overrides,
	});

	const createContext = (value: string, cursorOffset: number, state: VimState = createState()) => ({
		value,
		cursorOffset,
		state,
	});

	describe("motion commands", () => {
		it("should move cursor left with h", () => {
			const action = processNormalModeInput("h", createContext("hello", 3));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(2);
		});

		it("should not move cursor below 0 with h", () => {
			const action = processNormalModeInput("h", createContext("hello", 0));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(0);
		});

		it("should move cursor right with l", () => {
			const action = processNormalModeInput("l", createContext("hello", 2));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(3);
		});

		it("should not move cursor past end with l", () => {
			const action = processNormalModeInput("l", createContext("hello", 4));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(4);
		});

		it("should move to next word start with w", () => {
			const action = processNormalModeInput("w", createContext("hello world", 0));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(6);
		});

		it("should move to previous word start with b", () => {
			const action = processNormalModeInput("b", createContext("hello world", 8));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(6);
		});

		it("should move to word end with e", () => {
			const action = processNormalModeInput("e", createContext("hello world", 0));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(4);
		});

		it("should move to start of line with 0", () => {
			const action = processNormalModeInput("0", createContext("hello world", 5));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(0);
		});

		it("should move to end of line with $", () => {
			const action = processNormalModeInput("$", createContext("hello world", 0));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(10);
		});

		it("should move to first non-whitespace with ^", () => {
			const action = processNormalModeInput("^", createContext("   hello", 5));

			expect(action.type).toBe("cursor_move");
			expect(action.newCursorOffset).toBe(3);
		});
	});

	describe("mode change commands", () => {
		it("should switch to insert mode with i", () => {
			const action = processNormalModeInput("i", createContext("hello", 2));

			expect(action.type).toBe("mode_change");
			expect(action.newMode).toBe("insert");
		});

		it("should switch to insert mode after cursor with a", () => {
			const action = processNormalModeInput("a", createContext("hello", 2));

			expect(action.type).toBe("mode_change");
			expect(action.newMode).toBe("insert");
			expect(action.newCursorOffset).toBe(3);
		});

		it("should switch to insert mode at end of line with A", () => {
			const action = processNormalModeInput("A", createContext("hello", 2));

			expect(action.type).toBe("mode_change");
			expect(action.newMode).toBe("insert");
			expect(action.newCursorOffset).toBe(5);
		});

		it("should switch to insert mode at first non-whitespace with I", () => {
			const action = processNormalModeInput("I", createContext("   hello", 5));

			expect(action.type).toBe("mode_change");
			expect(action.newMode).toBe("insert");
			expect(action.newCursorOffset).toBe(3);
		});
	});

	describe("delete commands", () => {
		it("should delete character under cursor with x", () => {
			const action = processNormalModeInput("x", createContext("hello", 2));

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("helo");
			expect(action.newCursorOffset).toBe(2);
		});

		it("should delete character before cursor with X", () => {
			const action = processNormalModeInput("X", createContext("hello", 2));

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("hllo");
			expect(action.newCursorOffset).toBe(1);
		});

		it("should not delete with X at start of line", () => {
			const action = processNormalModeInput("X", createContext("hello", 0));

			expect(action.type).toBe("noop");
		});

		it("should delete to end of line with D", () => {
			const action = processNormalModeInput("D", createContext("hello world", 5));

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("hello");
		});

		it("should change to end of line with C", () => {
			const action = processNormalModeInput("C", createContext("hello world", 5));

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("hello");
			expect(action.newMode).toBe("insert");
		});
	});

	describe("delete with motion", () => {
		it("should delete word with dw", () => {
			const stateWithPendingD = createState({ pendingOperator: "d" });
			const action = processNormalModeInput(
				"w",
				createContext("hello world", 0, stateWithPendingD),
			);

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("world");
		});

		it("should delete previous word with db", () => {
			const stateWithPendingD = createState({ pendingOperator: "d" });
			const action = processNormalModeInput(
				"b",
				createContext("hello world", 6, stateWithPendingD),
			);

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("world");
		});

		it("should delete entire line with dd", () => {
			const stateWithPendingD = createState({ pendingOperator: "d" });
			const action = processNormalModeInput(
				"d",
				createContext("hello world", 5, stateWithPendingD),
			);

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("");
		});

		it("should delete to end of line with d$", () => {
			const stateWithPendingD = createState({ pendingOperator: "d" });
			const action = processNormalModeInput(
				"$",
				createContext("hello world", 5, stateWithPendingD),
			);

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe("hello");
		});

		it("should delete to start of line with d0", () => {
			const stateWithPendingD = createState({ pendingOperator: "d" });
			const action = processNormalModeInput(
				"0",
				createContext("hello world", 5, stateWithPendingD),
			);

			expect(action.type).toBe("delete");
			expect(action.newValue).toBe(" world");
		});
	});

	describe("undo", () => {
		it("should return undo action with u", () => {
			const action = processNormalModeInput("u", createContext("hello", 2));

			expect(action.type).toBe("undo");
		});
	});

	describe("isPendingOperator", () => {
		it("should return true for d", () => {
			expect(isPendingOperator("d")).toBe(true);
		});

		it("should return false for other keys", () => {
			expect(isPendingOperator("x")).toBe(false);
			expect(isPendingOperator("h")).toBe(false);
			expect(isPendingOperator("i")).toBe(false);
		});
	});
});
