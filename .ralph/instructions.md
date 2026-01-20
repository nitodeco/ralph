# Rules

- Follow the existing code style and conventions
- Verify implementation by running `bun check` before committing
- Create a changeset using `bun changeset` for each change
- After creating the changeset and verifying, stage all changes and commit with a meaningful commit message
- All commands should be available as CLI commands as well as slash commands in the Terminal UI
- Before commiting, if possible, verify that your implementation works by building the project and running the CLI with the dry run flag
- When implementing new commands, verify they work by running them  
- Never run commands that trigger ralph to start a session
