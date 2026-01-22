---
"ralph": patch
---

feat: add Ctrl+Home/End document start/end navigation to TextInput

The TextInput component now supports Ctrl+Home and Ctrl+End for document-level cursor navigation:

- Ctrl+Home moves the cursor to the beginning of the document (offset 0)
- Ctrl+End moves the cursor to the end of the document (after the last character)
