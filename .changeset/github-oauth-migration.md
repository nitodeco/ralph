---
"ralph": minor
---

feat: add OAuth device flow authentication for GitHub

- Added new `ralph auth` command with subcommands:
  - `ralph auth login` - Initiate GitHub OAuth device flow authentication
  - `ralph auth logout` - Revoke tokens and clear credentials
  - `ralph auth status` - Show current authentication status

- Updated GitHub integration to use OAuth tokens when available, falling back to PAT
- Added `/auth` slash command in terminal UI for OAuth authentication
- Updated `/github` view with OAuth login option alongside PAT setup
- Enhanced `ralph github` command to show authentication method (OAuth vs PAT)
- Added migration prompts for existing PAT users to switch to OAuth
- OAuth tokens are stored securely in global config alongside existing settings
