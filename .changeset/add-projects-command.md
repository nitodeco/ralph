---
"ralph": minor
---

Add project management commands for viewing and managing registered Ralph projects

- Added `ralph projects` CLI command to list all registered projects with name, path, type, and last accessed time
- Added `ralph projects current` subcommand to show details about the current directory's project
- Added `ralph projects prune` subcommand to remove orphaned projects with invalid paths
- Added `--json` flag support for all projects commands for scripting
- Added `/projects` slash command and interactive ProjectsView with keyboard navigation
- ProjectsView features: list view with highlighting, detail view, remove project, prune orphaned projects
