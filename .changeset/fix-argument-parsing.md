---
"ralph": patch
---

Fix argument parsing bug that prevented CLI commands from working

- Fixed critical bug in parseArgs function where the first CLI argument was always filtered out
- The filter condition `argIndex !== taskIndex + 1` incorrectly evaluated to `argIndex !== 0` when no --task flag was present (taskIndex = -1)
- Changed to `(taskIndex === -1 || argIndex !== taskIndex + 1)` to only filter the task value when --task flag is used
- This fix enables all CLI commands (status, list, config, help, etc.) to work correctly

