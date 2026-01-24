---
title: Quickstart
description: Get up and running with Ralph in minutes. Create your first PRD and start an automated development session.
sidebar:
  order: 3
  label: Quickstart
---

# Quickstart

This guide walks you through creating your first PRD and running an automated development session with Ralph.

## Initialize Ralph

Start by initializing Ralph in your project:

```bash
ralph init
```

You'll be prompted to:

1. **Describe your project** — Provide a brief description of what you want to build
2. **Select your AI agent** — Choose Cursor CLI, Claude Code, or Codex
3. **Review generated PRD** — Ralph will generate a PRD with tasks based on your description

Ralph stores project data in `~/.ralph/projects/<project-name>/`.

## Review Your PRD

View the generated tasks:

```bash
ralph task list
```

This shows all tasks with their completion status. Each task has:

- A number (for easy reference)
- A title
- A completion status (pending/done)

To see the next task to work on:

```bash
ralph task current
```

## Start a Session

Run Ralph to start working through your PRD:

```bash
ralph run
```

By default, Ralph runs 10 iterations. You can specify a different count:

```bash
ralph run 20
```

## What Happens During a Session

During each iteration, Ralph:

1. Checks current progress with `ralph progress` and `ralph task list`
2. Gets the next pending task with `ralph task current`
3. Instructs the AI agent to implement that task
4. Monitors for stuck states and timeouts
5. Records progress and marks tasks done
6. Commits changes

If an iteration fails, Ralph automatically retries with context about what went wrong.

## Monitor Progress

While Ralph is running (or after), check progress:

```bash
# View progress notes
ralph progress

# View task completion
ralph task list

# View session status
ralph status
```

## Resume a Session

If a session is interrupted, resume where you left off:

```bash
ralph resume
```

Ralph maintains session state in `~/.ralph/projects/<project>/session.json`, so you can safely stop and restart.

## Next Steps

- [Core Concepts: PRDs](/ralph/docs/core-concepts/prds/) — Learn how PRDs work
- [Core Concepts: Sessions](/ralph/docs/core-concepts/sessions-and-iterations/) — Understand the session lifecycle
- [CLI Reference](/ralph/docs/cli-reference/overview/) — Full command reference
