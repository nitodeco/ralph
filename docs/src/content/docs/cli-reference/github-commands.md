---
title: github & auth Commands
description: CLI reference for Ralph GitHub integration and authentication commands.
sidebar:
  order: 6
  label: github & auth
---

# github & auth Commands

These commands manage GitHub integration for creating pull requests and authenticating with GitHub.

## Authentication

### `ralph auth github`

Authenticate with GitHub to enable PR creation.

```bash
ralph auth github
```

This opens a browser for GitHub OAuth authentication. Once authenticated, Ralph can create pull requests on your behalf.

### Auth Status

Check your authentication status:

```bash
ralph auth status
```

## Creating Pull Requests

### `ralph github pr`

Create a pull request from your current session's changes.

```bash
ralph github pr
```

Ralph will:

1. Ensure all changes are committed
2. Push to a new branch
3. Create a PR with a summary of changes

### Options

| Option | Description |
|--------|-------------|
| `--title <title>` | Custom PR title |
| `--body <body>` | Custom PR description |
| `--draft` | Create as draft PR |
| `--base <branch>` | Target branch (default: main) |

### Examples

Create with custom title:

```bash
ralph github pr --title "Add user authentication"
```

Create as draft:

```bash
ralph github pr --draft
```

## PR Content

By default, Ralph generates PR content from:

- Task list and completion status
- Progress notes from the session
- Summary of changes made

You can override this with `--body`.

## Token Storage

GitHub tokens are stored securely and scoped to your project. You can revoke access anytime:

```bash
ralph auth logout
```

## Related

- [GitHub Integration Setup](/ralph/docs/github-integration/setup/) - Initial setup guide
- [Auth Methods](/ralph/docs/github-integration/auth-methods/) - Different authentication options
