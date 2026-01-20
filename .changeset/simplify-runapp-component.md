---
"ralph": patch
---

Refactor: Simplify RunApp component by extracting hooks and ViewRouter

- Extract useSlashCommands hook for slash command handling logic
- Extract useSessionLifecycle hook for session-related effects
- Create ViewRouter component for view switching logic
- Create MainRunView component for the main run view content
- Reduce RunApp from 310+ lines to ~150 lines with better separation of concerns
