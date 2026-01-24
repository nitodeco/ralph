---
title: PRDs
description: Understand how Product Requirements Documents work in Ralph and how to structure your tasks.
sidebar:
  order: 1
  label: PRDs
---

# PRDs

A Product Requirements Document (PRD) is the central artifact that drives Ralph's development sessions. It contains a structured list of tasks that Ralph works through sequentially.

## How PRDs Work

When you run `ralph init`, Ralph:

1. Asks you to describe what you want to build
2. Uses AI to generate a structured PRD with tasks
3. Stores the PRD in `~/.ralph/projects/<project>/prd.md`

The PRD is stored as JSON internally but can be viewed and edited through Ralph commands.

## Task Structure

Each task in a PRD has:

- **Title**: A concise description of what needs to be done
- **Status**: `pending` or `done`

Tasks should be:

- **Specific**: Clear enough for an AI agent to understand
- **Self-contained**: Completable without dependencies on other tasks
- **Testable**: Has clear completion criteria

## Managing Tasks

View all tasks:

```bash
ralph task list
```

Mark a task as done (by number or title):

```bash
ralph task done 1
ralph task done "Add authentication"
```

Mark a task as not done:

```bash
ralph task undone 1
```

Show the next pending task:

```bash
ralph task current
```

## Task Order

Tasks are processed in order. Ralph always works on the first pending task. If you need to change the order, you can:

1. Mark completed tasks as undone
2. Edit the PRD directly (advanced)

## Best Practices

### Break Down Large Features

Instead of:

```
Build user authentication system
```

Break it into:

```
1. Add user database schema
2. Implement signup endpoint
3. Implement login endpoint
4. Add password hashing
5. Create auth middleware
```

### Include Context in Task Titles

Give the AI agent enough context:

```
Add TypeScript types for user API responses in src/types/
```

### One Concern Per Task

Each task should address a single concern. This makes it easier for the AI agent to complete successfully and for you to verify.

## Next Steps

- [Tasks](/ralph/docs/core-concepts/tasks/) — Learn more about task management
- [Sessions & Iterations](/ralph/docs/core-concepts/sessions-and-iterations/) — Understand how Ralph processes tasks
