---
"ralph": patch
---

Add task mutation functions to PRD library

- Add toggleTaskDone function to toggle task done status
- Add deleteTask function to remove tasks by index
- Add reorderTask function to move tasks between positions
- All functions follow immutable patterns (return new Prd objects)
- Add comprehensive unit tests for all three functions
