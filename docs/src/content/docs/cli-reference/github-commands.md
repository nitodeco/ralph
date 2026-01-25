---
title: GitHub Commands
description: Reference for Ralph GitHub integration and authentication commands. Set up OAuth device flow or personal access tokens for PR creation and repository management.
sidebar:
  order: 6
  label: github & auth
---

# GitHub Commands

Ralph integrates with GitHub for authentication and PR creation. These commands manage that integration.

## Authentication Commands

### ralph auth

Show current authentication status.

```bash
ralph auth
```

**Output:**

```
GitHub Authentication:
  Status: Authenticated
  User: username
  Method: OAuth
```

### ralph auth login

Authenticate with GitHub using OAuth device flow.

```bash
ralph auth login
```

This initiates the OAuth device flow:

1. Ralph displays a code and URL
2. You visit the URL in your browser
3. Enter the code and authorize Ralph
4. Ralph stores the token securely

**No token needed** — this is the recommended authentication method.

### ralph auth logout

Disconnect from GitHub and clear credentials.

```bash
ralph auth logout
```

Removes stored GitHub credentials.

## GitHub Integration Commands

### ralph github

Show GitHub integration status.

```bash
ralph github
```

**Output:**

```
GitHub Integration:
  Status: Connected
  Repository: owner/repo
  Default branch: main
```

### ralph github set-token

Set a personal access token (legacy method).

```bash
ralph github set-token <token>
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<token>` | GitHub personal access token |

**Note:** Using `ralph auth login` with OAuth is preferred over personal access tokens.

### ralph github clear-token

Remove stored GitHub credentials.

```bash
ralph github clear-token
```

Alias for `ralph auth logout`.

## OAuth vs Token Authentication

### OAuth (Recommended)

```bash
ralph auth login
```

- No token to manage or rotate
- Secure device flow authentication
- Fine-grained permissions
- Automatic token refresh

### Personal Access Token (Legacy)

```bash
ralph github set-token ghp_xxxxx
```

- Requires manual token creation
- Token must be kept secure
- Need to manage expiration

## Token Permissions

Ralph requires these GitHub permissions:

| Permission | Purpose |
|------------|---------|
| `repo` | Access to repositories |
| `read:user` | Read user profile |

When using `ralph auth login`, you'll see exactly what permissions are requested.

## PR Creation

When authenticated, Ralph can create pull requests from completed work. This happens automatically at the end of a session when configured.

See [GitHub Integration: PR Creation](/docs/github-integration/pr-creation/) for configuration details.

## Troubleshooting

### "Not authenticated" Error

Run `ralph auth login` to authenticate:

```bash
ralph auth login
```

### Token Expired

If using a personal access token, generate a new one and update:

```bash
ralph github set-token <new-token>
```

Or switch to OAuth:

```bash
ralph auth logout
ralph auth login
```

### Wrong Repository

Ralph detects the repository from your git remote. Ensure you're in the correct directory and have a proper remote configured:

```bash
git remote -v
```

## Next Steps

- [GitHub Integration: Setup](/docs/github-integration/setup/) — Full setup guide
- [GitHub Integration: Auth Methods](/docs/github-integration/auth-methods/) — Detailed auth options
