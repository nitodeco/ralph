---
"ralph": minor
---

Add migration command and auto-migration prompt for global storage

- Add `ralph migrate` CLI command to migrate local .ralph directory to global storage
- Add `--remove` flag to delete local .ralph directory after successful migration
- Add MigrationPromptView component that prompts users to migrate when a local .ralph directory is detected
- Auto-detect migration needs on startup and show migration prompt
- Add `/migrate` slash command for in-app migration
- Migration copies all files (prd.json, session.json, progress.txt, logs/, archive/, etc.) to ~/.ralph/projects/
- After migration, users can choose to keep or delete the local .ralph directory as a backup
