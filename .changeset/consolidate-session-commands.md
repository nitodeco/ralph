---
"ralph": minor
---

Consolidate session-related commands under /session namespace

- Session control commands now use `/session <subcommand>` format:
  - `/session start [n|full]` - Start agent loop
  - `/session stop` - Stop the running agent
  - `/session resume` - Resume interrupted session
  - `/session pause` - Pause the current session (new)
  - `/session clear` - Clear session data
  - `/session refresh` - Reload PRD from disk
  - `/session archive` - Archive completed tasks
- Removed top-level `/start`, `/stop`, `/resume`, `/clear`, `/refresh`, `/archive` commands
- Added new `/session pause` command to pause without stopping
- Updated help text across CLI and TUI to reflect new command structure
