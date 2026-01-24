---
title: Common Settings
description: Detailed explanations of commonly used Ralph configuration options.
sidebar:
  order: 2
  label: Common Settings
---

# Common Settings

This page explains the most commonly adjusted Ralph configuration options in detail.

## Agent Selection

The `agent` setting determines which AI coding agent Ralph orchestrates.

```json
{
  "agent": "cursor"
}
```

### Cursor CLI

```json
{
  "agent": "cursor"
}
```

- Most common choice
- Requires [Cursor](https://cursor.sh/) to be installed
- Agent runs as `cursor` command

### Claude Code

```json
{
  "agent": "claude"
}
```

- Anthropic's Claude Code CLI
- Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installation
- Agent runs as `claude` command

### Codex

```json
{
  "agent": "codex"
}
```

- OpenAI's Codex CLI
- Requires [Codex CLI](https://github.com/openai/codex) installation
- Agent runs as `codex` command

## Timeout Configuration

### Agent Timeout

```json
{
  "agentTimeoutMs": 1800000
}
```

Maximum time for a single iteration. Default is 30 minutes (1,800,000 ms).

**Recommendations:**

- Simple tasks: 10-15 minutes (600,000-900,000 ms)
- Complex tasks: 30-45 minutes (1,800,000-2,700,000 ms)
- Tasks with builds/tests: 45-60 minutes (2,700,000-3,600,000 ms)

### Stuck Threshold

```json
{
  "stuckThresholdMs": 300000
}
```

Time without agent output before considering it stuck. Default is 5 minutes.

If the agent produces no output for this duration, Ralph triggers a retry with "stuck" context.

**Recommendations:**

- Most projects: 5 minutes (300,000 ms)
- Large builds: 10-15 minutes (600,000-900,000 ms)

### Max Runtime

```json
{
  "maxRuntimeMs": 0
}
```

Maximum total session runtime. 0 means unlimited.

Set this to prevent runaway sessions:

```json
{
  "maxRuntimeMs": 28800000
}
```

This limits sessions to 8 hours.

## Retry Configuration

### Max Retries

```json
{
  "maxRetries": 3
}
```

Maximum retry attempts when an iteration fails. After this many failures on the same task, Ralph moves on or stops.

### Retry Delay

```json
{
  "retryDelayMs": 5000
}
```

Delay between retries in milliseconds. This gives the system time to settle and avoids hammering the agent.

## Notifications

### System Notifications

```json
{
  "notifications": {
    "systemNotification": true
  }
}
```

Enables OS-level notifications when a session completes. Useful when running in background mode.

### Webhook Notifications

```json
{
  "notifications": {
    "webhookUrl": "https://hooks.slack.com/services/..."
  }
}
```

Sends a POST request to the webhook URL on session completion. Works with Slack, Discord, or any webhook receiver.

### Marker Files

```json
{
  "notifications": {
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

Creates a file at the specified path when the session completes. Useful for external monitoring or scripting.

## Memory Management

### Output Buffer

```json
{
  "memory": {
    "maxOutputBufferBytes": 5242880
  }
}
```

Maximum size of buffered agent output. Default is 5 MB. Increase for verbose agents.

### Memory Warning

```json
{
  "memory": {
    "memoryWarningThresholdMb": 500
  }
}
```

Ralph warns when process memory exceeds this threshold.

## Environment-Specific Configs

### Development

```json
{
  "maxRetries": 5,
  "agentTimeoutMs": 3600000,
  "notifications": {
    "systemNotification": true
  }
}
```

More retries and longer timeouts for iterative development.

### CI/CD

```json
{
  "maxRetries": 2,
  "agentTimeoutMs": 1200000,
  "maxRuntimeMs": 3600000
}
```

Stricter limits for automated environments.

## Next Steps

- [GitHub Integration](/ralph/docs/github-integration/setup/) — Configure GitHub features
- [Troubleshooting](/ralph/docs/troubleshooting/common-issues/) — Common configuration issues
