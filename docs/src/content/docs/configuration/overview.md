---
title: Configuration Overview
description: Learn how to configure Ralph with global and project-level settings. Customize agent selection, timeouts, retries, notifications, memory limits, and custom instructions.
sidebar:
  order: 1
  label: Overview
---

# Configuration

Ralph uses a layered configuration system that allows you to set global defaults and override them per-project. This flexibility lets you customize timeouts, retries, notifications, and more to match your workflow.

## Configuration Hierarchy

Ralph merges configuration from two levels:

```
Global Config (~/.ralph/config.json)
    ↓
Project Config (~/.ralph/projects/<project>/config.json)
    ↓
Effective Configuration (merged, project overrides global)
```

### Configuration Files

| Location | Purpose | Scope |
|----------|---------|-------|
| `~/.ralph/config.json` | Global defaults for all projects | All projects |
| `~/.ralph/projects/<project>/config.json` | Project-specific overrides | Single project |

## Viewing Configuration

See your current effective configuration:

```bash
ralph config
```

Output shows merged settings:

```json
{
  "agent": "cursor",
  "maxRetries": 3,
  "retryDelayMs": 5000,
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000,
  "maxRuntimeMs": 0,
  "notifications": {
    "systemNotification": true
  }
}
```

With source information:

```bash
ralph config --verbose
```

Shows which settings come from global vs project config.

## Initial Setup

Configure global preferences interactively:

```bash
ralph setup
```

This wizard walks you through:

1. **Agent Selection** — Choose Cursor CLI, Claude Code, or Codex
2. **Timeout Settings** — Configure iteration and stuck thresholds
3. **Retry Behavior** — Set max retries and delays
4. **Notifications** — Enable system notifications or webhooks

## Configuration Options

### Agent Selection

Choose which AI agent Ralph uses:

```json
{
  "agent": "cursor"
}
```

| Value | Description | Command |
|-------|-------------|---------|
| `"cursor"` | Cursor CLI (most common) | `cursor` |
| `"claude"` | Claude Code | `claude` |
| `"codex"` | OpenAI Codex CLI | `codex` |

**When to change:**

- Switching between different AI agents
- Testing which agent works best for your project
- Using different agents for different projects

**Example:**

```bash
# Global: Use Cursor by default
echo '{"agent": "cursor"}' > ~/.ralph/config.json

# Project: Use Claude for this specific project
echo '{"agent": "claude"}' > ~/.ralph/projects/my-project/config.json
```

### Retry Settings

Control how Ralph handles failed iterations:

```json
{
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

| Option | Default | Description | Range |
|--------|---------|-------------|-------|
| `maxRetries` | 3 | Max retry attempts per task | 0-10 |
| `retryDelayMs` | 5000 | Delay between retries (ms) | 0-60000 |

**When to adjust:**

- **Increase retries** for complex tasks that often need multiple attempts
- **Decrease retries** to fail fast and move on
- **Increase delay** if agent needs time to recover between attempts
- **Decrease delay** for faster iteration cycles

**Examples:**

```json
// Patient: More retries for complex projects
{
  "maxRetries": 5,
  "retryDelayMs": 10000
}

// Fast-fail: Fewer retries for simple tasks
{
  "maxRetries": 1,
  "retryDelayMs": 1000
}
```

### Timeout Settings

Control iteration and session time limits:

```json
{
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000,
  "maxRuntimeMs": 0
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `agentTimeoutMs` | 1800000 (30 min) | Max time per iteration |
| `stuckThresholdMs` | 300000 (5 min) | No-output threshold |
| `maxRuntimeMs` | 0 (unlimited) | Total session time limit |

**When to adjust:**

**agentTimeoutMs:**

- Increase for complex tasks (large refactors, migrations)
- Decrease for simple tasks to fail faster

**stuckThresholdMs:**

- Increase if agent legitimately needs long pauses
- Decrease to detect stuck states faster

**maxRuntimeMs:**

- Set for overnight runs to prevent infinite sessions
- Leave at 0 for unlimited development time

**Examples:**

```json
// Long-running complex tasks
{
  "agentTimeoutMs": 3600000,    // 1 hour per iteration
  "stuckThresholdMs": 600000,   // 10 min stuck threshold
  "maxRuntimeMs": 28800000      // 8 hour max session
}

// Quick iterations
{
  "agentTimeoutMs": 600000,     // 10 min per iteration
  "stuckThresholdMs": 120000,   // 2 min stuck threshold
  "maxRuntimeMs": 0             // No session limit
}
```

### Notification Settings

Get notified when sessions complete:

```json
{
  "notifications": {
    "systemNotification": true,
    "webhookUrl": "https://hooks.slack.com/services/...",
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

| Option | Type | Description |
|--------|------|-------------|
| `systemNotification` | boolean | Show OS notification on completion |
| `webhookUrl` | string | POST to webhook on completion |
| `markerFilePath` | string | Create file when session completes |

**Use cases:**

**System Notifications:**

```json
{
  "notifications": {
    "systemNotification": true
  }
}
```

Get a desktop notification when Ralph finishes.

**Slack Webhook:**

```json
{
  "notifications": {
    "webhookUrl": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX"
  }
}
```

Post to Slack channel when session completes.

**Marker File:**

```json
{
  "notifications": {
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

Create a file that other scripts can watch for.

**All Together:**

```json
{
  "notifications": {
    "systemNotification": true,
    "webhookUrl": "https://hooks.slack.com/services/...",
    "markerFilePath": ".ralph/complete.marker"
  }
}
```

### Memory Settings

Control memory usage and garbage collection:

```json
{
  "memory": {
    "maxOutputBufferBytes": 5242880,
    "memoryWarningThresholdMb": 500,
    "memoryThresholdMb": 1024,
    "enableGarbageCollectionHints": true
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxOutputBufferBytes` | 5242880 (5 MB) | Max agent output buffer size |
| `memoryWarningThresholdMb` | 500 | Warn when memory exceeds this |
| `memoryThresholdMb` | 1024 | Stop session at this threshold |
| `enableGarbageCollectionHints` | true | Enable GC hints |

**When to adjust:**

- **Decrease buffer** if running on low-memory systems
- **Increase thresholds** for long-running sessions
- **Disable GC hints** if experiencing performance issues

**Examples:**

```json
// Low-memory system
{
  "memory": {
    "maxOutputBufferBytes": 2621440,      // 2.5 MB
    "memoryWarningThresholdMb": 250,
    "memoryThresholdMb": 512
  }
}

// High-memory system with long sessions
{
  "memory": {
    "maxOutputBufferBytes": 10485760,     // 10 MB
    "memoryWarningThresholdMb": 1000,
    "memoryThresholdMb": 2048
  }
}
```

## Configuration Examples

### Development Laptop

Fast iterations, desktop notifications:

```json
{
  "agent": "cursor",
  "maxRetries": 3,
  "retryDelayMs": 5000,
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000,
  "notifications": {
    "systemNotification": true
  }
}
```

### CI/CD Server

No notifications, strict timeouts:

```json
{
  "agent": "cursor",
  "maxRetries": 2,
  "retryDelayMs": 2000,
  "agentTimeoutMs": 600000,
  "stuckThresholdMs": 120000,
  "maxRuntimeMs": 3600000,
  "notifications": {
    "systemNotification": false,
    "markerFilePath": "/tmp/ralph-complete"
  }
}
```

### Overnight Long-Running Session

Extended timeouts, Slack notifications:

```json
{
  "agent": "cursor",
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
    "memoryWarningThresholdMb": 1000
  }
}
```

### Complex Refactoring Project

Patient retries, long timeouts:

```json
{
  "agent": "claude",
  "maxRetries": 5,
  "retryDelayMs": 15000,
  "agentTimeoutMs": 5400000,
  "stuckThresholdMs": 900000,
  "notifications": {
    "systemNotification": true
  }
}
```

## Custom Instructions

Add project-specific instructions that are included in every agent prompt.

Create `~/.ralph/projects/<project>/instructions.md`:

```markdown
# Project Instructions

## Technology Stack
- TypeScript with strict mode
- Bun as runtime and package manager
- Prisma for database operations
- Express for API server

## Code Standards
- Use functional programming patterns
- Prefer immutability
- Write descriptive variable names
- Add JSDoc comments for public APIs

## Project Structure
- API routes in src/routes/
- Business logic in src/services/
- Database models in src/models/
- Utilities in src/lib/

## Testing
- Write tests in __tests__/ directories
- Use Bun's test runner
- Aim for 80%+ coverage
```

Ralph includes these instructions in every iteration, ensuring the agent follows your project's conventions.

## Per-Project Configuration

Override global settings for specific projects:

```bash
cd my-project

# Create project config
cat > ~/.ralph/projects/my-project/config.json << EOF
{
  "agent": "claude",
  "agentTimeoutMs": 3600000,
  "maxRetries": 5
}
EOF
```

Now this project uses Claude with longer timeouts, while other projects use global settings.

## Environment Variables

Some settings can be overridden with environment variables:

```bash
# Override agent for one session
RALPH_AGENT=claude ralph run

# Override timeout
RALPH_TIMEOUT=3600000 ralph run

# Run with debug logging
RALPH_DEBUG=true ralph run
```

## Configuration Best Practices

### Start with Defaults

Don't over-configure initially. Use defaults and adjust based on experience:

```json
{
  "agent": "cursor"
}
```

### Tune Per Project

Different projects have different needs:

- **Simple CRUD apps**: Default timeouts work fine
- **Complex refactors**: Increase timeouts and retries
- **Large migrations**: Increase all limits

### Monitor and Adjust

Watch for patterns:

- **Frequent timeouts**: Increase `agentTimeoutMs`
- **Agent getting stuck**: Decrease `stuckThresholdMs`
- **Tasks failing repeatedly**: Increase `maxRetries`

### Use Project Config for Exceptions

Keep global config simple, use project config for special cases:

```bash
# Global: Sensible defaults
~/.ralph/config.json

# Project: Special requirements
~/.ralph/projects/legacy-refactor/config.json
```

## Troubleshooting Configuration

### Configuration Not Taking Effect

**Problem:** Changed config but behavior unchanged

**Solutions:**

1. Verify config file syntax (must be valid JSON)
2. Check you're editing the right file (global vs project)
3. Restart session after config changes
4. Verify with `ralph config`

### Invalid Configuration

**Problem:** Ralph reports invalid config

**Solution:** Validate JSON syntax:

```bash
# Check global config
cat ~/.ralph/config.json | jq .

# Check project config
cat ~/.ralph/projects/my-project/config.json | jq .
```

### Settings Conflict

**Problem:** Unsure which settings are active

**Solution:** Use verbose config view:

```bash
ralph config --verbose
```

Shows source of each setting (global vs project).

## Next Steps

- [Common Settings](/docs/configuration/common-settings/) — Detailed explanations of each setting
- [GitHub Integration](/docs/github-integration/setup/) — Configure GitHub authentication
- [Troubleshooting](/docs/troubleshooting/common-issues/) — Solutions to common configuration issues
