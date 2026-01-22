---
"ralph": minor
---

feat: add CLI commands for dependency management

Added new `ralph dependency` command with subcommands:

- `dependency` / `dependency graph` - Show dependency graph for all tasks
- `dependency validate` - Validate task dependencies (detect cycles, missing refs)
- `dependency ready` - List tasks ready for execution (dependencies satisfied)
- `dependency blocked` - List tasks blocked by incomplete dependencies
- `dependency order` - Show parallel execution groups in order
- `dependency show <task>` - Show dependency details for a specific task
- `dependency set <task> <dep1> [dep2...]` - Set dependencies for a task
- `dependency add <task> <dep>` - Add a dependency to a task
- `dependency remove <task> <dep>` - Remove a dependency from a task

All commands support `--json` flag for programmatic output.
