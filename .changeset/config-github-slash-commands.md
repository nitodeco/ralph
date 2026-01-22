---
"ralph": minor
---

Add config and GitHub integration management via slash commands

Added new slash commands and CLI functionality:
- /config - View current configuration settings in the Terminal UI
- /github - Interactive GitHub integration setup (token, PR settings)
- ralph github - CLI command to view/manage GitHub settings
- ralph github set-token - Set GitHub personal access token
- ralph github clear-token - Remove GitHub token

The ConfigView displays all effective configuration including agent settings,
retry/timeout settings, notifications, memory management, and git provider config.

The GitHubSetupView provides a menu-driven interface for:
- Setting/updating GitHub personal access token (masked display)
- Toggling auto-create PR on task completion
- Toggling PR draft mode
- Clearing stored token
