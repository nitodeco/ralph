---
"ralph": patch
---

feat: add up/down arrow line navigation to TextInput component

The TextInput component now supports navigating between lines in multiline text using the up and down arrow keys. When pressing up/down:

- The cursor moves to the equivalent column position on the previous/next line
- If the target line is shorter, the cursor is clamped to the end of that line
- External onArrowUp/onArrowDown callbacks are only triggered when already at the first/last line

This improves the multiline text editing experience when pasting or entering multi-line content.
