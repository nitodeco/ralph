---
"ralph": patch
---

feat: add Ctrl+Left/Right word-by-word navigation to TextInput

The TextInput component now supports Ctrl+Left and Ctrl+Right for word-by-word cursor navigation:

- Ctrl+Left moves the cursor to the beginning of the previous word
- Ctrl+Right moves the cursor to the end of the next word

Word boundaries are determined by transitions between word characters (alphanumeric and underscore) and non-word characters.
