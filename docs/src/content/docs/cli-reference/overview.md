---
title: Command Overview
description: Complete reference for all Ralph CLI commands and their options.
sidebar:
  order: 1
  label: Overview
---

# CLI Reference

Ralph provides a comprehensive set of commands for managing PRD-driven development sessions. This page gives an overview of all available commands.

## Basic Usage

```bash
ralph                     # Open the Ralph UI
ralph <command> [options] # Run a specific command
```

## Core Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize a new PRD project |
| `run [n]` | Run n iterations (default: 10) |
| `resume` | Resume a previously interrupted session |
| `stop` | Stop a running Ralph process |
| `status` | Show current session state and progress |

## Task Commands

| Command | Description |
|---------|-------------|
| `task list` | List all tasks with status |
| `task current` | Show the next pending task |
| `task done <id>` | Mark a task as done |
| `task undone <id>` | Mark a task as not done |

## Progress Commands

| Command | Description |
|---------|-------------|
| `progress` | Show progress notes |
| `progress add <text>` | Add a progress note |
| `progress clear` | Clear all progress notes |

## Session Commands

| Command | Description |
|---------|-------------|
| `session` | Show session information |
| `archive` | Archive completed tasks and progress |
| `clear` | Clear session data (archives first) |

## Configuration Commands

| Command | Description |
|---------|-------------|
| `config` | View current configuration |
| `setup` | Configure global preferences |

## Guardrails Commands

| Command | Description |
|---------|-------------|
| `guardrails` | List all guardrails |
| `guardrails add <text>` | Add a new guardrail |
| `guardrails remove <id>` | Remove a guardrail |
| `guardrails toggle <id>` | Enable/disable a guardrail |
| `guardrails generate` | Auto-generate guardrails |

## Analysis Commands

| Command | Description |
|---------|-------------|
| `analyze` | Show failure pattern analysis |
| `analyze debt` | Show technical debt review |
| `analyze export` | Export analysis as JSON |
| `analyze clear` | Clear failure history |
| `memory` | Show session memory |
| `memory export` | Export memory as markdown |
| `memory clear` | Clear session memory |

## GitHub Commands

| Command | Description |
|---------|-------------|
| `auth` | Show authentication status |
| `auth login` | Authenticate with GitHub |
| `auth logout` | Disconnect from GitHub |
| `github` | Show GitHub integration status |

## Project Commands

| Command | Description |
|---------|-------------|
| `projects` | List all registered projects |
| `projects current` | Show current project details |
| `projects prune` | Remove invalid projects |
| `migrate` | Migrate local .ralph to global storage |

## Utility Commands

| Command | Description |
|---------|-------------|
| `usage` | View usage statistics |
| `update` | Check for and install updates |
| `help` | Show help message |

## Global Options

| Option | Description |
|--------|-------------|
| `-b, --background` | Run in background/daemon mode |
| `--dry-run` | Simulate without running agents |
| `--json` | Output in JSON format |

## Next Steps

- [Task Commands](/ralph/docs/cli-reference/task-commands/) — Detailed task command reference
- [Progress Commands](/ralph/docs/cli-reference/progress-commands/) — Working with progress notes
- [Session Commands](/ralph/docs/cli-reference/session-commands/) — Managing sessions
