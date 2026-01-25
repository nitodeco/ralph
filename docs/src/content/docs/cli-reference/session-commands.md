---
title: Session Commands
description: Reference for Ralph session management commands including run, resume, stop, status, archive, and clear. Control session execution, background mode, and state persistence.
sidebar:
  order: 4
  label: session
---

# Session Commands

Session commands control the execution of development sessions and manage session state.

## ralph run

Start a new session and run iterations.

```bash
ralph run [iterations]
```

**Arguments:**

| Argument | Description | Default |
|----------|-------------|---------|
| `iterations` | Number of iterations to run | 10 |

**Examples:**

```bash
# Run 10 iterations (default)
ralph run

# Run 20 iterations
ralph run 20

# Run in background mode
ralph run -b

# Dry run (simulate without agents)
ralph run --dry-run
```

**Options:**

| Option | Description |
|--------|-------------|
| `-b, --background` | Run detached from terminal |
| `--dry-run` | Simulate without running agents |

## ralph resume

Resume a previously interrupted session.

```bash
ralph resume
```

Restores the session state from `~/.ralph/projects/<project>/session.json` and continues from where it left off.

**Options:**

| Option | Description |
|--------|-------------|
| `-b, --background` | Resume in background mode |

## ralph stop

Stop a running Ralph process gracefully.

```bash
ralph stop
```

Sends a graceful stop signal to any running Ralph process for the current project. The session state is preserved.

## ralph status

Show current session state and recent activity.

```bash
ralph status
```

**Output:**

```
Session Status:
  State: running
  Iteration: 5/10
  Current task: Implement user API endpoints

Recent Progress:
  [10:30] Set up TypeScript configuration
  [10:45] Added Prisma schema

Recent Logs:
  [10:50] Starting iteration 5
  [10:51] Agent spawned
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

## ralph archive

Archive completed tasks and progress.

```bash
ralph archive
```

Creates a timestamped archive of:

- Completed tasks
- Progress notes
- Session logs

Archives are stored in `~/.ralph/projects/<project>/archives/`.

## ralph clear

Clear session data and start fresh.

```bash
ralph clear
```

**Behavior:**

1. Creates an archive of current state (like `ralph archive`)
2. Resets the session state
3. Preserves the PRD and configuration

Use this to start a fresh session while keeping your task definitions.

## Session State

Session state is stored in `~/.ralph/projects/<project>/session.json`:

```json
{
  "iteration": 5,
  "startedAt": "2024-01-15T10:00:00Z",
  "status": "running"
}
```

### State Values

| Status | Description |
|--------|-------------|
| `idle` | No session active |
| `running` | Session in progress |
| `paused` | Session interrupted |
| `completed` | All tasks done or limit reached |

## Background Mode

Running in background mode:

```bash
ralph run -b
```

- Detaches Ralph from the terminal
- Session continues running
- Check status with `ralph status`
- Stop with `ralph stop`

## Next Steps

- [Guardrails Commands](/docs/cli-reference/guardrails-commands/) — Project guardrails
- [GitHub Commands](/docs/cli-reference/github-commands/) — GitHub integration
