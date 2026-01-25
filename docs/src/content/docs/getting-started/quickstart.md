---
title: Quickstart
description: Get up and running with Ralph in under 10 minutes. Create your first PRD, configure your AI agent, and start an automated development session with progress tracking.
sidebar:
  order: 3
  label: Quickstart
---

# Quickstart

This guide walks you through creating your first PRD and running an automated development session with Ralph. You'll go from zero to a working AI-orchestrated development session in under 10 minutes.

## Prerequisites

Before starting, ensure you have:

- Ralph installed ([Installation guide](/docs/getting-started/installation/))
- An AI agent (Cursor CLI, Claude Code, or Codex) installed and in your PATH
- A project directory (can be empty or existing)

## Step 1: Initialize Ralph

Navigate to your project directory and initialize Ralph:

```bash
cd your-project
ralph init
```

### What You'll See

Ralph will prompt you with a series of questions:

```
? Describe what you want to build:
```

Provide a clear description of your project. For example:

```
Build a REST API for a todo app with user authentication,
CRUD operations for todos, and PostgreSQL database
```

Next, Ralph asks which AI agent to use:

```
? Select your AI agent:
  ❯ Cursor CLI
    Claude Code
    Codex
```

Use arrow keys to select your agent and press Enter.

### Generated PRD

Ralph uses AI to generate a structured PRD with tasks:

```
✓ Generated PRD with 8 tasks

Tasks:
  1. Set up project structure and dependencies
  2. Configure PostgreSQL database connection
  3. Create user authentication schema
  4. Implement user registration endpoint
  5. Implement user login endpoint
  6. Create todo model and schema
  7. Implement todo CRUD endpoints
  8. Add authentication middleware

✓ Saved to ~/.ralph/projects/your-project/
```

## Step 2: Review Your Tasks

View all generated tasks:

```bash
ralph task list
```

Output:

```
[ ] 1. Set up project structure and dependencies
[ ] 2. Configure PostgreSQL database connection
[ ] 3. Create user authentication schema
[ ] 4. Implement user registration endpoint
[ ] 5. Implement user login endpoint
[ ] 6. Create todo model and schema
[ ] 7. Implement todo CRUD endpoints
[ ] 8. Add authentication middleware

Total: 8 | Done: 0 | Pending: 8
```

Check which task Ralph will work on first:

```bash
ralph task current
```

Output:

```
Current task: [1] Set up project structure and dependencies
```

## Step 3: Start Your First Session

Start Ralph with the default 10 iterations:

```bash
ralph run
```

Or specify a custom iteration count:

```bash
ralph run 20
```

### What Happens Next

Ralph displays a real-time UI showing:

```
┌─ Ralph Session ─────────────────────────────────────┐
│                                                      │
│  Status: Running                                     │
│  Iteration: 1 / 10                                   │
│  Current Task: Set up project structure              │
│                                                       │
│  Agent Output:                                       │
│  > Installing dependencies...                        │
│  > Creating project structure...                     │
│  > Setting up TypeScript configuration...            │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### The Iteration Loop

During each iteration, Ralph:

1. **Reads current state** — Runs `ralph task list` and `ralph progress` to understand what's been done
2. **Gets next task** — Runs `ralph task current` to find the next pending task
3. **Spawns AI agent** — Launches your chosen agent with the task and context
4. **Monitors execution** — Watches for completion signals, timeouts, or stuck states
5. **Records progress** — When the agent calls `ralph task done`, marks the task complete
6. **Commits changes** — Automatically commits the work with a descriptive message
7. **Moves to next task** — Repeats the process for the next pending task

### Automatic Retries

If an iteration fails (timeout, error, or stuck), Ralph automatically retries with additional context:

```
⚠ Iteration 3 failed: Agent timeout
↻ Retrying (attempt 1/3) with failure context...
```

## Step 4: Monitor Progress

While Ralph runs, you can monitor progress in another terminal:

```bash
ralph status
```

Output:

```
Session Status:
  State: Running
  Iteration: 3 / 10
  Started: 2 minutes ago
  
Current Task:
  [3] Create user authentication schema
  
Recent Progress:
  ✓ Set up project structure and dependencies
  ✓ Configure PostgreSQL database connection
  → Working on: Create user authentication schema
```

View detailed progress notes:

```bash
ralph progress
```

Output:

```
Progress Notes:

[2 minutes ago]
Completed project setup with TypeScript, Express, and Prisma.
Installed all dependencies and configured tsconfig.json.

[1 minute ago]
Configured PostgreSQL connection using Prisma.
Created .env file with database credentials.
Migration system is ready.
```

View task completion:

```bash
ralph task list
```

Output:

```
[✓] 1. Set up project structure and dependencies
[✓] 2. Configure PostgreSQL database connection
[→] 3. Create user authentication schema
[ ] 4. Implement user registration endpoint
[ ] 5. Implement user login endpoint
[ ] 6. Create todo model and schema
[ ] 7. Implement todo CRUD endpoints
[ ] 8. Add authentication middleware

Total: 8 | Done: 2 | Pending: 6
```

## Step 5: Stop and Resume

### Stopping a Session

Press `Ctrl+C` to gracefully stop Ralph, or in another terminal:

```bash
ralph stop
```

Ralph saves session state before exiting:

```
✓ Session stopped gracefully
✓ State saved to ~/.ralph/projects/your-project/session.json
```

### Resuming a Session

Resume where you left off:

```bash
ralph resume
```

Ralph restores the session and continues:

```
✓ Restored session from 5 minutes ago
→ Resuming at iteration 4 / 10
→ Current task: Implement user registration endpoint
```

## Step 6: Run in Background

For long-running sessions, run Ralph in the background:

```bash
ralph run -b
```

Or:

```bash
ralph run --background
```

Ralph detaches from the terminal:

```
✓ Ralph started in background (PID: 12345)
→ Check status with: ralph status
```

Monitor with:

```bash
ralph status
```

## Common First-Time Issues

### Agent Not Found

```
Error: cursor: command not found
```

**Solution:** Ensure your AI agent is installed and in your PATH:

```bash
which cursor  # Should return a path
```

If not found, install the agent first.

### No Tasks Generated

If `ralph init` generates no tasks, your description may be too vague. Try being more specific:

```
Bad:  "Build an app"
Good: "Build a REST API with Express and PostgreSQL for managing todos"
```

### Session Stops Immediately

Check the logs for errors:

```bash
cat ~/.ralph/projects/your-project/logs/latest.log
```

Common causes:
- Git not initialized in the project
- No write permissions in the project directory
- Agent configuration issues

## Next Steps

Now that you've completed your first session, explore:

- [Core Concepts: PRDs](/docs/core-concepts/prds/) — Learn how to write effective PRDs
- [Core Concepts: Sessions & Iterations](/docs/core-concepts/sessions-and-iterations/) — Understand the execution model
- [Configuration](/docs/configuration/overview/) — Customize timeouts, retries, and notifications
- [CLI Reference](/docs/cli-reference/overview/) — Full command documentation
- [GitHub Integration](/docs/github-integration/setup/) — Set up automatic PR creation

## Quick Reference

```bash
ralph init              # Initialize a new project
ralph run [n]           # Run n iterations (default: 10)
ralph run -b            # Run in background
ralph status            # Check session status
ralph stop              # Stop running session
ralph resume            # Resume interrupted session
ralph task list         # View all tasks
ralph task current      # View next task
ralph progress          # View progress notes
```
