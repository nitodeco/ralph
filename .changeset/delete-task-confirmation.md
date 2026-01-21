---
"ralph": patch
---

Add delete task functionality with confirmation to TasksView

- Add 'x' key handler to enter delete confirmation mode
- Show confirmation prompt with task title and red border
- Handle Enter to confirm deletion, Escape to cancel
- Adjust selected index after deletion to stay in bounds
- Update help text to show 'x' key shortcut
