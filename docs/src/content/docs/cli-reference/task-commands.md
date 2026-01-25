---
title: Task Commands
description: Complete reference for Ralph task management commands.
sidebar:
  order: 2
  label: task
---

# Task Commands

Task commands manage the tasks in your PRD. These are the primary way to track progress through your project.

## ralph task list

List all tasks with their completion status.

```bash
ralph task list
```

**Output:**

```
[✓] 1. Set up project scaffolding
[✓] 2. Add database schema
[ ] 3. Implement user API endpoints
[ ] 4. Add authentication middleware

Total: 4 | Done: 2 | Pending: 2
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

## ralph task current

Show the next pending task that will be worked on.

```bash
ralph task current
```

**Output:**

```
Current task: [3] Implement user API endpoints
```

If all tasks are complete:

```
All tasks complete!
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

## ralph task done

Mark a task as completed.

```bash
# By task number
ralph task done 3

# By title (partial match)
ralph task done "user API"
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number or title substring |

**Behavior:**

- Finds the task by number or title match
- Marks it as done
- Records the completion timestamp

**Usage by AI agents:**

The AI agent calls this command when it completes a task. Ralph monitors for this signal to know when to move to the next iteration.

## ralph task undone

Mark a task as not completed.

```bash
ralph task undone 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number or title substring |

**Use cases:**

- Re-process a task that wasn't done correctly
- Reset progress for testing
- Change the order of task execution

## ralph task add

Add a new task to the PRD.

```bash
ralph task add --title "Implement user authentication" --description "Add JWT-based auth"
```

**Options:**

| Option | Description |
|--------|-------------|
| `--title` | Task title |
| `--description` | Task description |
| `--steps` | Implementation steps (can be specified multiple times) |
| `--stdin` | Read task data from stdin |

**Examples:**

```bash
ralph task add --title "Add login endpoint" --description "Create POST /api/login"

ralph task add --title "Setup database" --steps "Install Prisma" --steps "Create schema"
```

## ralph task edit

Edit an existing task.

```bash
ralph task edit 3 --title "Updated title"
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to edit |

**Options:**

| Option | Description |
|--------|-------------|
| `--title` | New task title |
| `--description` | New task description |
| `--steps` | New implementation steps |
| `--stdin` | Read task data from stdin |

## ralph task show

Show detailed information about a specific task.

```bash
ralph task show 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to show |

## ralph task remove

Remove a task from the PRD.

```bash
ralph task remove 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | Task number to remove |

## Task Identification

Tasks can be identified by:

### Number

Tasks are numbered starting from 1. Use the number shown in `ralph task list`:

```bash
ralph task done 1
```

### Title Substring

Match by any substring of the task title:

```bash
ralph task done "authentication"
```

If multiple tasks match, Ralph will prompt for clarification or use the first match.

## JSON Output

All task commands support `--json` for programmatic access:

```bash
ralph task list --json
```

```json
{
  "tasks": [
    {"number": 1, "title": "Set up project scaffolding", "done": true},
    {"number": 2, "title": "Add database schema", "done": true},
    {"number": 3, "title": "Implement user API endpoints", "done": false}
  ],
  "total": 3,
  "done": 2,
  "pending": 1
}
```

## Next Steps

- [Dependency Commands](/ralph/docs/cli-reference/dependency-commands/) — Managing task dependencies
- [Progress Commands](/ralph/docs/cli-reference/progress-commands/) — Recording progress notes
- [Session Commands](/ralph/docs/cli-reference/session-commands/) — Managing sessions
