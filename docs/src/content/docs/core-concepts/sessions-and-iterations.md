---
title: Sessions & Iterations
description: Understand how Ralph manages development sessions and executes iterations to complete tasks.
sidebar:
  order: 3
  label: Sessions & Iterations
---

# Sessions & Iterations

Ralph organizes work into **sessions** composed of **iterations**. Understanding this model helps you configure Ralph effectively and troubleshoot issues.

## Sessions

A session is a continuous run of Ralph working through your PRD. Sessions:

- Start when you run `ralph run` or `ralph resume`
- Continue until all tasks are complete, the iteration limit is reached, or you stop manually
- Persist state in `~/.ralph/projects/<project>/session.json`

### Session State

Sessions track:

- **Current iteration number**: Progress through the session
- **Task completion status**: Which tasks are done
- **Progress notes**: Notes added during the session
- **Error history**: Failed iterations and their causes

### Starting a Session

```bash
# Start a new session (default 10 iterations)
ralph run

# Start with custom iteration count
ralph run 20
```

### Resuming a Session

If a session is interrupted:

```bash
ralph resume
```

This restores the session state and continues from where it left off.

### Session Status

Check what's happening:

```bash
ralph status
```

Shows current session state, recent progress, and any active agents.

### Stopping a Session

```bash
ralph stop
```

Gracefully stops the current session. State is preserved for resuming later.

## Iterations

An iteration is a single AI agent run within a session. During each iteration:

1. Ralph reads the current task
2. Prepares context (progress notes, guardrails, instructions)
3. Spawns the AI agent with the task
4. Monitors agent output for completion signals
5. Handles success or failure

### Iteration Outcomes

Each iteration ends in one of these states:

- **Success**: Task completed, agent called `ralph task done`
- **Timeout**: Agent exceeded the configured timeout
- **Stuck**: No output for too long (stuck threshold)
- **Error**: Agent exited with an error
- **Decomposed**: Task was decomposed into subtasks

### Timeouts and Thresholds

Configure iteration behavior in `~/.ralph/config.json`:

```json
{
  "agentTimeoutMs": 1800000,
  "stuckThresholdMs": 300000
}
```

- **agentTimeoutMs**: Maximum time for one iteration (default: 30 minutes)
- **stuckThresholdMs**: Time without output before considering agent stuck (default: 5 minutes)

## The Iteration Loop

Here's what happens during a typical iteration:

```
1. ralph task current → Get next task
2. Build agent prompt with:
   - Task description
   - Project guardrails
   - Custom instructions
   - Progress context
3. Spawn AI agent (Cursor/Claude/Codex)
4. Stream and monitor output
5. Detect completion or failure:
   - Success: ralph task done called
   - Failure: timeout, stuck, or error
6. If failed: retry with failure context
7. Move to next iteration
```

## Background Mode

Run Ralph in the background:

```bash
ralph run --background
```

Or simply:

```bash
ralph run -b
```

Ralph detaches from the terminal and continues running. Check status with `ralph status`.

## Next Steps

- [Verification & Retries](/ralph/docs/core-concepts/verification-and-retries/) — How Ralph handles failures
- [Configuration](/ralph/docs/configuration/overview/) — Configure timeouts and behavior
