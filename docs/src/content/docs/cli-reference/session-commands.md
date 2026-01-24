---
title: session Commands
description: CLI reference for Ralph session management commands.
sidebar:
  order: 4
  label: session
---

# session Commands

The `session` command group manages development sessions.

## `ralph run`

Start a new session or resume an existing one.

```bash
ralph run
```

This is the primary command for running Ralph. It:

1. Loads your PRD
2. Finds the next pending task
3. Starts the AI agent
4. Monitors progress
5. Handles retries and errors

### Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Show what would happen without executing |

## `ralph status`

Show the current session status.

```bash
ralph status
```

**Output:**

```
Session Status

Project: my-project
Session: active
Current task: Implement login endpoint
Completed: 2/4 tasks
Last activity: 5 minutes ago
```

## `ralph stop`

Stop the current session gracefully.

```bash
ralph stop
```

This signals the agent to stop after completing its current action. The session state is saved and can be resumed later.

## `ralph session logs`

View logs from past iterations.

```bash
ralph session logs
```

### View Specific Iteration

```bash
ralph session logs --iteration 3
```

### Tail Mode

Watch logs in real-time:

```bash
ralph session logs --follow
```

## Session Files

Sessions are stored in:

```
~/.ralph/projects/<project>/
├── session.json      # Session state
├── session-memory.json
└── logs/
    ├── iteration-1.log
    ├── iteration-2.log
    └── ...
```

## Clearing Session State

To start fresh, you can clear the session:

```bash
ralph session clear
```

This removes session state but preserves your PRD and configuration.

## Related

- [Sessions & Iterations](/ralph/docs/core-concepts/sessions-and-iterations/) - How sessions work
