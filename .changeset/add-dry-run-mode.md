---
"ralph": minor
---

Add dry-run mode for testing PRD and configuration

- Added --dry-run flag to CLI that simulates agent execution
- Validates configuration and PRD files at startup
- Displays what would be executed without making changes
- Shows iteration-by-iteration simulation flow
- Reports validation errors and warnings
- Cannot be combined with background mode

