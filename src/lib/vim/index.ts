export { isPendingOperator, processNormalModeInput } from "./actions.ts";
export {
	findFirstNonWhitespace,
	findNextWordStart,
	findPreviousWordStart,
	findWordEnd,
} from "./motions.ts";
export type { UndoEntry, VimAction, VimMode, VimState } from "./types.ts";
export { useVimMode } from "./useVimMode.ts";
