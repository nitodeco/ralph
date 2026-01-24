---
title: FAQ
description: Frequently asked questions about Ralph.
sidebar:
  order: 1
  label: FAQ
---

# Frequently Asked Questions

## General

### What is Ralph?

Ralph is a CLI tool for long-running PRD-driven development with AI coding agents. It orchestrates agents like Cursor CLI to work through tasks defined in a Product Requirements Document (PRD), with automatic retries, progress tracking, and GitHub integration.

### Which AI agents does Ralph support?

Ralph supports:

- **Cursor CLI** — The most commonly used option
- **Claude Code** — Anthropic's Claude Code CLI
- **Codex** — OpenAI's Codex CLI

### Is Ralph free?

Yes, Ralph itself is free and open source under the MIT license. However, you need a subscription to the AI agent you choose to use (e.g., Cursor Pro).

### Does Ralph work offline?

Ralph requires the AI agent to have internet access. The agents themselves connect to their respective AI services (Anthropic, OpenAI, etc.).

## Installation

### How do I install Ralph?

The easiest way is the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

See [Installation](/ralph/docs/getting-started/installation/) for alternatives.

### What are the system requirements?

- macOS, Linux, or Windows (via WSL)
- One of the supported AI agents installed
- Git (for version control and GitHub features)

### How do I update Ralph?

```bash
ralph update
```

This checks for updates and installs the latest version.

## Usage

### How do I start a new project?

```bash
ralph init
```

This interactively creates a PRD with tasks based on your description.

### How do I run Ralph?

```bash
ralph run
```

This starts a session with 10 iterations. Specify more: `ralph run 20`

### How do I stop Ralph?

```bash
ralph stop
```

Or press `Ctrl+C` if running in the foreground.

### How do I check progress?

```bash
ralph status    # Session status
ralph progress  # Progress notes
ralph task list # Task completion
```

### Can I run Ralph in the background?

Yes:

```bash
ralph run -b
```

Check on it with `ralph status`.

## Tasks and PRDs

### Can I edit the PRD manually?

Yes, but it's recommended to use Ralph commands (`ralph task done`, `ralph task undone`) for status changes. The PRD file is at `~/.ralph/projects/<project>/prd.md`.

### How do I add more tasks?

Re-run `ralph init` or edit the PRD file directly to add tasks.

### What makes a good task?

Good tasks are:

- Specific and clear
- Completable in 5-15 minutes
- Self-contained (no dependencies)

See [Core Concepts: Tasks](/ralph/docs/core-concepts/tasks/) for more.

## Configuration

### Where is configuration stored?

- Global: `~/.ralph/config.json`
- Per-project: `~/.ralph/projects/<project>/config.json`

### How do I change the AI agent?

Edit config or run setup:

```bash
ralph setup
```

Or directly:

```json
{
  "agent": "claude"
}
```

### How do I increase timeouts?

Edit your config:

```json
{
  "agentTimeoutMs": 3600000
}
```

See [Configuration](/ralph/docs/configuration/overview/) for all options.

## GitHub Integration

### Do I need GitHub to use Ralph?

No, GitHub integration is optional. Ralph works fine for local development without it.

### How do I connect GitHub?

```bash
ralph auth login
```

See [GitHub Integration](/ralph/docs/github-integration/setup/) for details.

## Troubleshooting

### Ralph keeps retrying the same task

The agent may be stuck. Try:

1. Simplifying the task
2. Adding more context via guardrails
3. Checking logs for specific errors

### Agent times out frequently

Increase the timeout:

```json
{
  "agentTimeoutMs": 3600000
}
```

Or break tasks into smaller pieces.

### Where are the logs?

```
~/.ralph/projects/<project>/logs/
```

See [Where to Find Logs](/ralph/docs/troubleshooting/logs/) for details.

## Contributing

### How do I contribute?

See [Local Development](/ralph/docs/contributing/local-development/) to set up your environment.

### How do I report bugs?

Open an issue on [GitHub](https://github.com/nitodeco/ralph/issues) with:

- Ralph version
- Steps to reproduce
- Expected vs actual behavior

## More Questions?

If your question isn't answered here:

- Check the [docs](/ralph/docs/)
- Search [GitHub Issues](https://github.com/nitodeco/ralph/issues)
- Open a new issue
