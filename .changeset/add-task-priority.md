---
"ralph": minor
---

Add task priority and manual task selection

- Added optional 'priority' field (high/medium/low) to PrdTask type
- Tasks are now sorted by priority when selecting the next task to work on
- Added /next command to manually select which task to work on next
- Updated TaskList component to show priority indicators with colored icons
- Added --task (-t) CLI flag for single task execution mode
- Updated ralph list command to display priority information
