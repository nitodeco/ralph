---
title: Verification & Retries
description: How Ralph verifies task completion and handles failures through automatic retries with context.
sidebar:
  order: 4
  label: Verification & Retries
---

# Verification & Retries

Ralph includes automatic verification and retry mechanisms to handle the inherent uncertainty of AI agent runs. This ensures tasks actually get completed, not just attempted.

## Retry Mechanism

When an iteration fails, Ralph automatically retries with additional context.

### Retry Configuration

```json
{
  "maxRetries": 3,
  "retryDelayMs": 5000
}
```

- **maxRetries**: Maximum retry attempts per task (default: 3)
- **retryDelayMs**: Delay between retries in milliseconds (default: 5000)

### How Retries Work

On failure, Ralph:

1. Captures the failure reason (timeout, error, stuck state)
2. Waits for the retry delay
3. Re-runs the agent with additional context:
   - What failed in the previous attempt
   - Any error messages
   - Suggestions based on failure patterns

This gives the AI agent a better chance of succeeding on retry.

### Retry Context Injection

The retry prompt includes:

```
Previous attempt failed:
- Failure type: [timeout/error/stuck]
- Details: [error message or timeout info]
- Suggestion: [based on failure analysis]

Please address these issues and complete the task.
```

## Failure Analysis

Ralph tracks failure patterns to improve over time.

### View Analysis

```bash
ralph analyze
```

Shows patterns in your failure history:

- Most common failure types
- Tasks that frequently fail
- Suggested improvements

### Export Analysis

```bash
ralph analyze export
```

Exports detailed analysis as JSON for further processing.

### Clear History

```bash
ralph analyze clear
```

Resets the failure history.

## Stuck Detection

Beyond timeouts, Ralph detects when an agent is "stuck" — running but not producing output.

```json
{
  "stuckThresholdMs": 300000
}
```

If no output is received for 5 minutes (default), Ralph considers the agent stuck and triggers a retry.

## Session Memory

Ralph maintains session memory to learn from past successes and failures.

### View Memory

```bash
ralph memory
```

Shows lessons learned, successful patterns, and notes from previous sessions.

### Export Memory

```bash
ralph memory export
```

Exports memory as markdown for review or sharing.

## Best Practices

### Set Appropriate Timeouts

- Simple tasks: 5-10 minutes
- Complex tasks: 15-30 minutes
- Tasks requiring external services: account for latency

### Review Failure Patterns

Regularly run `ralph analyze` to identify recurring issues. Often, failure patterns point to:

- Tasks that need decomposition
- Missing context in task descriptions
- Configuration issues

## Next Steps

- [Configuration](/ralph/docs/configuration/overview/) — Full configuration reference
- [Troubleshooting](/ralph/docs/troubleshooting/common-issues/) — Common issues and solutions
