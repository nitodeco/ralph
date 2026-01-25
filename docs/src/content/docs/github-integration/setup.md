---
title: GitHub Integration Setup
description: Set up Ralph's GitHub integration for authentication and automatic PR creation. Configure OAuth device flow or personal access tokens with step-by-step setup instructions.
sidebar:
  order: 1
  label: Setup
---

# GitHub Integration Setup

Ralph integrates with GitHub to authenticate users and create pull requests from completed work. This guide walks through the setup process.

## Quick Setup

The fastest way to set up GitHub integration:

```bash
ralph auth login
```

This initiates OAuth device flow authentication — no token creation needed.

## Prerequisites

- A GitHub account
- Git configured with a remote pointing to a GitHub repository

Verify your remote:

```bash
git remote -v
```

You should see something like:

```
origin  git@github.com:owner/repo.git (fetch)
origin  git@github.com:owner/repo.git (push)
```

## Authentication

### OAuth Device Flow (Recommended)

```bash
ralph auth login
```

1. Ralph displays a code and URL
2. Open the URL in your browser
3. Enter the code when prompted
4. Authorize the Ralph application
5. Return to your terminal — authentication is complete

**Benefits:**

- No manual token creation
- Secure OAuth flow
- Automatic token refresh
- Fine-grained permissions

### Personal Access Token (Alternative)

If you prefer using a personal access token:

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with `repo` scope
3. Set the token:

```bash
ralph github set-token ghp_xxxxx
```

## Verify Setup

Check that everything is configured:

```bash
ralph auth
```

Should show:

```
GitHub Authentication:
  Status: Authenticated
  User: your-username
  Method: OAuth
```

Also verify the repository detection:

```bash
ralph github
```

Should show:

```
GitHub Integration:
  Status: Connected
  Repository: owner/repo
  Default branch: main
```

## Permissions Required

Ralph requests these GitHub permissions:

| Permission | Purpose |
|------------|---------|
| `repo` | Read/write access to repositories |
| `read:user` | Read your user profile |

These permissions allow Ralph to:

- Create branches
- Create pull requests
- Push commits
- Read repository information

## Project Detection

Ralph automatically detects the GitHub repository from your git remote configuration. It looks for:

1. Remote named `origin`
2. Remote URL matching `github.com`

If your setup is different, ensure at least one remote points to GitHub.

## Multiple Projects

Each project can have its own GitHub configuration. Ralph stores credentials globally but detects the repository per-project based on the git remote.

## Disconnecting

To remove GitHub integration:

```bash
ralph auth logout
```

This clears stored credentials. You can reconnect at any time with `ralph auth login`.

## Next Steps

- [Auth Methods](/docs/github-integration/auth-methods/) — Detailed authentication options
- [PR Creation](/docs/github-integration/pr-creation/) — Configure automatic PR creation
