---
"ralph": patch
---

Fix Ctrl+Enter keybind not working when editing task after PRD generation. The TextInput component was consuming all Enter key events, including Ctrl+Enter, preventing the parent handler from processing the save action. Now TextInput explicitly allows Ctrl+Enter and Meta+Enter events to propagate to parent handlers.
