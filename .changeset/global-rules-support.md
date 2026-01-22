---
"ralph": minor
---

Add global rules support. Rules can now be scoped as either global (stored at `~/.ralph/rules.json`) or project-specific. Global rules apply to all projects, while project rules only apply to the current project.

- Add `--global` / `-g` flag to `ralph rules add` command
- Display rules grouped by scope in `ralph rules list`
- Add scope selection UI in the interactive rules view (press 'a', then 'g' for global or 'p' for project)
