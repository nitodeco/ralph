---
"ralph": minor
---

Add confirmation dialogs for destructive actions

- Created reusable `ConfirmationDialog` component in `src/components/common/`
- Added confirmation dialog to `MemoryView` when pressing 'c' to clear all session memory
- Added confirmation dialog to `GuardrailsView` when pressing 'd' to delete a guardrail
- Added `ConfirmClearView` for the `/clear` slash command with session summary
- Added `--force` (or `-f`) flag to `ralph clear` CLI command to skip confirmation
- Added `--force` flag to `ralph memory clear` CLI command to skip confirmation
- CLI commands now show interactive readline prompts for confirmation when not using `--force`
