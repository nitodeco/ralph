---
"ralph": minor
---

Add CLI-based task operations for /plan command

- Add `ralph task add` command to add new tasks via `--stdin` JSON or flags
- Add `ralph task edit <n>` command to edit existing tasks (partial updates, preserves done status)
- Add `ralph task remove <n>` command to remove tasks by index
- Add `ralph task show <n>` command to display full task details (description, steps)
- Update `/plan` prompt to show full task content and instruct AI to use CLI commands
- Add command parser to extract task operations from AI output instead of parsing JSON
- Prevents task content degradation by only touching tasks relevant to the specification
