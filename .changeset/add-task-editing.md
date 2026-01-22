---
"ralph": minor
---

Add task editing to TasksView component

- Add 'edit' view mode to TasksView component alongside 'list' and 'confirm-delete'
- Add updateTask function to prd.ts for updating task properties
- Implement inline text editing for task title, description, and steps
- Add 'e' key binding to trigger edit mode for selected task
- Add Tab/Shift+Tab for field navigation and Ctrl+Enter to save
- Update footer to show edit mode controls
- Add status message feedback after successful task edit
