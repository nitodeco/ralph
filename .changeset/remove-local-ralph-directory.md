---
"ralph": minor
---

Remove local `.ralph/` directory requirement - all project data now stored in `~/.ralph/projects/`

- Projects are auto-registered on first use without requiring `ralph init`
- Auto-migrate existing local `.ralph/` data to global location on startup
- Fix macOS symlink path normalization (e.g., `/var` -> `/private/var`)
- Remove migration prompt UI and related state management
- Simplify `ralph migrate` command to only clean up local directories
