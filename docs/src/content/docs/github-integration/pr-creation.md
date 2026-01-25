---
title: PR Creation
description: Configure how Ralph creates pull requests from completed work. Learn about automatic PR generation, branch naming conventions, PR content customization, and best practices.
sidebar:
  order: 3
  label: PR Creation
---

# PR Creation

Ralph can create pull requests from completed development sessions. This page explains how to configure and use this feature.

## Overview

When a session completes, Ralph can:

1. Create a new branch with your changes
2. Push the branch to GitHub
3. Open a pull request with a summary of completed tasks

## Requirements

- GitHub authentication configured (`ralph auth login`)
- Git repository with a GitHub remote
- Uncommitted changes or commits ready to push

## Basic Usage

PR creation is typically triggered at the end of a session. Ralph will prompt you to create a PR when appropriate.

## PR Contents

Ralph generates PR content based on:

### Title

Derived from the completed tasks or session summary.

### Description

Includes:

- Summary of completed tasks
- Progress notes from the session
- Any relevant context

### Branch Naming

Ralph creates branches with a descriptive name based on the work done:

```
ralph/feature-description
ralph/task-123-add-authentication
```

## Manual PR Creation

If you prefer to create PRs manually:

1. Complete your session normally
2. Review changes: `git status`
3. Create your own branch and PR

Ralph doesn't interfere with manual git workflows.

## Best Practices

### Atomic PRs

For best results, organize tasks so each session produces a coherent PR:

- Group related tasks together
- Keep sessions focused on a single feature

### Review Before Pushing

Ralph may prompt you to review changes before creating a PR. Take this opportunity to:

- Verify the code looks correct
- Check for any missed files
- Ensure tests pass

### PR Description Quality

The auto-generated PR description includes task completion info. You can edit it on GitHub after creation for additional context.

## Troubleshooting

### "Not authenticated"

Run `ralph auth login` to connect GitHub.

### "No remote found"

Ensure your repository has a GitHub remote:

```bash
git remote add origin git@github.com:owner/repo.git
```

### "Permission denied"

Your token may lack `repo` scope. Re-authenticate:

```bash
ralph auth logout
ralph auth login
```

## Next Steps

- [Configuration](/docs/configuration/overview/) — Configure Ralph behavior
- [Troubleshooting](/docs/troubleshooting/common-issues/) — Common issues and solutions
