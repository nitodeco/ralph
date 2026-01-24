---
title: Configuration Overview
description: Learn how to configure Ralph with global and project-level settings.
sidebar:
  order: 1
  label: Overview
---

# Configuration

Ralph uses a layered configuration system with global and project-level settings. Project settings override global settings, allowing you to customize behavior per project.

## Configuration Files

| Location | Purpose |
|----------|---------|
| `~/.ralph/config.json` | Global defaults |
| `~/.ralph/projects/<project>/config.json` | Project-specific overrides |

## Viewing Configuration

See current effective configuration:

```bash
ralph config
```

This shows merged settings from both global and project levels.

## Configuration Options

### Agent Selection

```json
{
  "agent": "cursor"
}
```

| Value | Description |
|-------|-------------|
| `"cursor"` | Use Cursor CLI |
| `"claude"` | Use Claude Code |
| `"codex"` | Use OpenAI Codex CLI |

### Retry Settings

```json
{
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | 3 | Max retry attempts per task |
| `retryDelayMs` | 5000 | Delay between retries (ms) |

### Timeout Settings

```json
{
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000,
  "maxRuntimeMs": 0
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `agentTimeoutMs` | 1800000 | Max time per iteration (30 min) |
| `stuckThresholdMs` | 300000 | No-output threshold (5 min) |
| `maxRuntimeMs` | 0 | Total session limit (0 = unlimited) |

### Notification Settings

```json
{
  "notifications": {
    "systemNotification": true,
    "webhookUrl": "https://hooks.slack.com/...",
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

| Option | Description |
|--------|-------------|
| `systemNotification` | OS notification on completion |
| `webhookUrl` | Webhook for completion notifications |
| `markerFilePath` | File created when session completes |

### Memory Settings

```json
{
  "memory": {
    "maxOutputBufferBytes": 5242880,
    "memoryWarningThresholdMb": 500,
    "enableGarbageCollectionHints": true
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxOutputBufferBytes` | 5242880 | Max agent output buffer (5 MB) |
| `memoryWarningThresholdMb` | 500 | Memory warning threshold |
| `enableGarbageCollectionHints` | true | Enable GC hints |

## Example Configuration

A complete project configuration:

```json
{
  "agent": "claude",
  "maxRetries": 5,
  "retryDelayMs": 10000,
  "agentTimeoutMs": 3600000,
  "stuckThresholdMs": 600000,
  "maxRuntimeMs": 28800000,
  "notifications": {
    "systemNotification": true,
    "webhookUrl": "https://hooks.slack.com/services/..."
  },
  "memory": {
    "maxOutputBufferBytes": 10485760,
    "memoryWarningThresholdMb": 750
  }
}
```

## Initial Setup

Configure global preferences interactively:

```bash
ralph setup
```

This walks you through setting your preferred agent and common options.

## Custom Instructions

Add project-specific instructions in `~/.ralph/projects/<project>/instructions.md`. These are included in every agent prompt:

```markdown
# Project Instructions

- This is a TypeScript project using Bun
- Use Prisma for database operations
- Follow the existing code patterns in src/
```

## Next Steps

- [Common Settings](/ralph/docs/configuration/common-settings/) — Detailed setting explanations
- [GitHub Integration](/ralph/docs/github-integration/setup/) — Configure GitHub features
