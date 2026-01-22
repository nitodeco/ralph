---
"ralph": minor
---

Implement GitHub Provider Integration

Adds the first concrete implementation of the GitProvider interface for GitHub, enabling automatic PR creation for GitHub repositories.

Features:
- Create, get, update, and close pull requests via GitHub API
- Support for draft PRs
- Add labels and reviewers on PR creation
- Custom API URL support for GitHub Enterprise
- Proper error handling with detailed error messages

The provider is automatically registered at bootstrap and can be configured via:
- `gitProvider.github.token` - GitHub personal access token
- `gitProvider.github.apiUrl` - Custom API URL (optional, defaults to api.github.com)

This enables the upcoming branch mode PR creation workflow for GitHub repositories.
