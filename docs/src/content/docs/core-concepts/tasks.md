---
title: Tasks
description: Learn how tasks work in Ralph, including status management and the task lifecycle.
sidebar:
  order: 2
  label: Tasks
---

# Tasks

Tasks are the fundamental unit of work in Ralph. Each task represents a discrete piece of development work that an AI agent can complete in a single iteration.

## Task Lifecycle

A task moves through these states:

1. **Pending** — Not yet started
2. **In Progress** — Currently being worked on by the agent (during a session)
3. **Done** — Completed successfully

## Task Commands

### List All Tasks

```bash
ralph task list
```

Output shows task numbers, titles, and status:

```
[✓] 1. Set up project scaffolding
[✓] 2. Add database schema
[ ] 3. Implement user API endpoints
[ ] 4. Add authentication middleware
```

### Show Current Task

```bash
ralph task current
```

Returns the next pending task that Ralph will work on.

### Mark Task Done

By number:

```bash
ralph task done 3
```

By title (partial match supported):

```bash
ralph task done "user API"
```

### Mark Task Undone

```bash
ralph task undone 3
```

Use this to re-process a task or fix the order of completion.

## How Tasks Are Processed

During a session, Ralph:

1. Runs `ralph task current` to find the next pending task
2. Provides the task to the AI agent with context
3. Monitors the agent's progress
4. When the agent calls `ralph task done`, the task is marked complete
5. Moves to the next pending task

## Task Decomposition

Sometimes a task is too complex for a single iteration. Ralph supports automatic task decomposition:

1. The agent detects the task is too large
2. Agent outputs a `DECOMPOSE_TASK` marker with suggested subtasks
3. Ralph replaces the original task with smaller subtasks
4. Work continues on the first subtask

This allows large tasks to be broken down dynamically during execution.

## Progress Notes

In addition to marking tasks done, the agent can record progress notes:

```bash
ralph progress add "Completed API endpoints, tests passing"
```

View all progress notes:

```bash
ralph progress
```

Progress notes persist across sessions and provide context for future iterations.

## Best Practices

### Keep Tasks Atomic

Each task should be small enough to complete in one iteration (typically 5-15 minutes of AI agent work).

### Use Clear Titles

Task titles should be unambiguous. The AI agent only sees the title, so it needs all necessary context.

### Let Ralph Decompose

If you're unsure how to break down a feature, start with a high-level task. Ralph can decompose it automatically if needed.

## Next Steps

- [Sessions & Iterations](/ralph/docs/core-concepts/sessions-and-iterations/) — Understand the execution model
- [Verification & Retries](/ralph/docs/core-concepts/verification-and-retries/) — How Ralph handles failures
