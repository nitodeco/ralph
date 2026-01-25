---
title: Task Commands
description: Complete reference for Ralph task management commands including list, current, done, undone, add, edit, show, and remove. Includes JSON output options and scripting examples.
sidebar:
  order: 2
  label: task
---

# Task Commands

Task commands manage the tasks in your PRD. These are the primary way to track progress through your project.

## ralph task list

List all tasks with their completion status.

### Usage

```bash
ralph task list
```

### Output

```
[✓] 1. Set up Express server with TypeScript
[✓] 2. Configure PostgreSQL database connection
[✓] 3. Create user authentication schema
[→] 4. Implement user signup endpoint
[ ] 5. Implement user login endpoint
[ ] 6. Add JWT token generation utility
[ ] 7. Create authentication middleware
[ ] 8. Protect API routes with middleware

Total: 8 | Done: 3 | Pending: 5
```

### Status Indicators

| Indicator | Meaning |
|-----------|---------|
| `[✓]` | Task completed |
| `[→]` | Task in progress (current iteration) |
| `[ ]` | Task pending |

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--json` | Output in JSON format | `ralph task list --json` |

### JSON Output

```bash
ralph task list --json
```

```json
{
  "tasks": [
    {
      "id": "1",
      "number": 1,
      "title": "Set up Express server with TypeScript",
      "status": "done",
      "completedAt": "2024-01-20T10:15:00Z"
    },
    {
      "id": "2",
      "number": 2,
      "title": "Configure PostgreSQL database connection",
      "status": "done",
      "completedAt": "2024-01-20T10:30:00Z"
    },
    {
      "id": "3",
      "number": 3,
      "title": "Create user authentication schema",
      "status": "done",
      "completedAt": "2024-01-20T10:45:00Z"
    },
    {
      "id": "4",
      "number": 4,
      "title": "Implement user signup endpoint",
      "status": "pending"
    }
  ],
  "total": 8,
  "done": 3,
  "pending": 5
}
```

### Use Cases

**Check overall progress:**
```bash
ralph task list
```

**Programmatic access:**
```bash
ralph task list --json | jq '.done'
```

**Count pending tasks:**
```bash
ralph task list --json | jq '.pending'
```

## ralph task current

Show the next pending task that will be worked on.

### Usage

```bash
ralph task current
```

### Output

When tasks are pending:

```
Current task: [4] Implement user signup endpoint
```

When all tasks are complete:

```
All tasks complete! 🎉
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--json` | Output in JSON format | `ralph task current --json` |

### JSON Output

```bash
ralph task current --json
```

```json
{
  "id": "4",
  "number": 4,
  "title": "Implement user signup endpoint",
  "status": "pending"
}
```

When complete:

```json
{
  "complete": true,
  "message": "All tasks complete"
}
```

### Use Cases

**Check what Ralph will work on next:**
```bash
ralph task current
```

**In scripts:**
```bash
CURRENT=$(ralph task current --json | jq -r '.title')
echo "Working on: $CURRENT"
```

## ralph task done

Mark a task as completed.

### Usage

```bash
# By task number
ralph task done 4

# By title (partial match)
ralph task done "signup endpoint"

# By full title
ralph task done "Implement user signup endpoint"
```

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `<id>` | number \| string | Task number or title substring |

### Behavior

1. Finds the task by number or title match
2. Marks it as `done`
3. Records completion timestamp
4. Saves to PRD file

### Output

```
✓ Task #4 marked as done: Implement user signup endpoint
```

If task not found:

```
Error: Task not found: "nonexistent"
```

If multiple matches:

```
Multiple tasks match "user":
  [4] Implement user signup endpoint
  [5] Implement user login endpoint
  
Please be more specific or use task number.
```

### Examples

**Mark task done by number:**
```bash
ralph task done 4
```

**Mark task done by partial title:**
```bash
ralph task done "signup"
```

**In agent workflow:**

The AI agent calls this when completing a task:

```bash
# Agent completes work
git add .
git commit -m "feat: implement signup endpoint"

# Agent marks task done
ralph task done 4
ralph progress add "Created POST /api/auth/signup with validation and password hashing"
```

Ralph monitors for this call to know when to move to the next iteration.

### Use Cases

**Manual completion:**

If you complete a task yourself:

```bash
# Do the work
# ... make changes ...

# Mark it done
ralph task done 4
ralph progress add "Completed manually"
```

**Fixing incorrect status:**

If a task was incorrectly left pending:

```bash
ralph task done 3
```

**Skipping a task:**

If a task is no longer needed:

```bash
ralph task done 5
ralph progress add "Skipped - no longer needed"
```

## ralph task undone

Mark a task as not completed (reset to pending).

### Usage

```bash
ralph task undone 4
```

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `<id>` | number \| string | Task number or title substring |

### Behavior

1. Finds the task by number or title
2. Changes status from `done` to `pending`
3. Removes completion timestamp
4. Saves to PRD file

### Output

```
✓ Task #4 marked as undone: Implement user signup endpoint
```

### Examples

**Reset a task:**
```bash
ralph task undone 4
```

**Reset multiple tasks:**
```bash
ralph task undone 4
ralph task undone 5
ralph task undone 6
```

### Use Cases

**Re-process a task:**

If a task wasn't completed correctly:

```bash
ralph task undone 4
ralph run  # Will work on task 4 again
```

**Change execution order:**

If tasks were completed out of order:

```bash
# Reset tasks 4 and 5
ralph task undone 4
ralph task undone 5

# Now they'll be processed again in order
ralph run
```

**Testing:**

Reset progress for testing:

```bash
ralph task undone 1
ralph task undone 2
ralph task undone 3
ralph run  # Start from beginning
```

**Fix mistakes:**

If you accidentally marked the wrong task done:

```bash
ralph task undone 5
ralph task done 4  # Mark the correct one
```

## ralph task add

Add a new task to the PRD.

### Usage

```bash
ralph task add --title "Task title"
ralph task add --title "Task title" --description "Details"
ralph task add --title "Task title" --steps "Step 1" --steps "Step 2"
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `--title` | string | Task title (required) |
| `--description` | string | Task description (optional) |
| `--steps` | string[] | Implementation steps (optional, repeatable) |
| `--stdin` | boolean | Read task data from stdin (optional) |

### Output

```
✓ Added task #9: Add rate limiting middleware
```

### Examples

**Simple task:**
```bash
ralph task add --title "Add rate limiting middleware"
```

**Task with description:**
```bash
ralph task add \
  --title "Add rate limiting middleware" \
  --description "Protect API from abuse using express-rate-limit"
```

**Task with steps:**
```bash
ralph task add \
  --title "Add rate limiting middleware" \
  --steps "Install express-rate-limit package" \
  --steps "Configure rate limits (100 req/15min)" \
  --steps "Apply to authentication endpoints"
```

**From stdin:**
```bash
cat << EOF | ralph task add --stdin
{
  "title": "Add rate limiting middleware",
  "description": "Protect API from abuse",
  "steps": [
    "Install express-rate-limit",
    "Configure rate limits",
    "Apply to endpoints"
  ]
}
EOF
```

### Use Cases

**Adding forgotten tasks:**
```bash
ralph task add --title "Write API documentation"
```

**Breaking down complex tasks:**
```bash
ralph task remove 5
ralph task add --title "Create user model"
ralph task add --title "Create user migration"
ralph task add --title "Add user validation"
```

**Adding tasks during development:**
```bash
# Discover new requirement
ralph task add --title "Add email verification"
```

## ralph task edit

Edit an existing task.

### Usage

```bash
ralph task edit <id> --title "New title"
ralph task edit <id> --description "New description"
ralph task edit <id> --title "New title" --description "New description"
```

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `<id>` | number | Task number to edit |

### Options

| Option | Type | Description |
|--------|------|-------------|
| `--title` | string | New task title |
| `--description` | string | New task description |
| `--steps` | string[] | New implementation steps |
| `--stdin` | boolean | Read task data from stdin |

### Output

```
✓ Updated task #4: Implement user signup endpoint with email verification
```

### Examples

**Update title:**
```bash
ralph task edit 4 --title "Implement user signup endpoint with email verification"
```

**Update description:**
```bash
ralph task edit 4 --description "Create POST /api/auth/signup with email verification flow"
```

**Update both:**
```bash
ralph task edit 4 \
  --title "Implement user signup with verification" \
  --description "Add email verification to signup flow"
```

**Update with steps:**
```bash
ralph task edit 4 \
  --title "Implement user signup" \
  --steps "Create signup endpoint" \
  --steps "Add email validation" \
  --steps "Send verification email" \
  --steps "Create verification endpoint"
```

### Use Cases

**Clarify vague tasks:**
```bash
ralph task edit 5 --title "Implement JWT-based authentication with refresh tokens"
```

**Add more context:**
```bash
ralph task edit 5 --description "Use jsonwebtoken library, 15min access tokens, 7day refresh tokens"
```

**Fix typos:**
```bash
ralph task edit 3 --title "Create user authentication schema"
```

## ralph task show

Show detailed information about a specific task.

### Usage

```bash
ralph task show <id>
```

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `<id>` | number | Task number to show |

### Output

```
Task #4
Title: Implement user signup endpoint
Status: pending
Created: 2024-01-20 10:00:00

Description:
Create POST /api/auth/signup endpoint that accepts email and password,
validates input, hashes password with bcrypt, and creates user in database.

Steps:
1. Create signup route handler
2. Add input validation (email format, password strength)
3. Hash password with bcrypt (10 rounds)
4. Save user to database with Prisma
5. Return JWT token with user data
```

For completed tasks:

```
Task #3
Title: Create user authentication schema
Status: done
Created: 2024-01-20 10:00:00
Completed: 2024-01-20 10:45:00
Duration: 45 minutes

Description:
Create Prisma schema for user authentication with email and password.
```

### Examples

**View task details:**
```bash
ralph task show 4
```

**View with JSON:**
```bash
ralph task show 4 --json
```

```json
{
  "id": "4",
  "number": 4,
  "title": "Implement user signup endpoint",
  "status": "pending",
  "createdAt": "2024-01-20T10:00:00Z",
  "description": "Create POST /api/auth/signup...",
  "steps": [
    "Create signup route handler",
    "Add input validation",
    "Hash password with bcrypt",
    "Save user to database",
    "Return JWT token"
  ]
}
```

### Use Cases

**Review task before starting:**
```bash
ralph task current
ralph task show 4
```

**Check task details:**
```bash
ralph task show 4
```

**Export task data:**
```bash
ralph task show 4 --json > task-4.json
```

## ralph task remove

Remove a task from the PRD.

### Usage

```bash
ralph task remove <id>
```

### Arguments

| Argument | Type | Description |
|----------|------|-------------|
| `<id>` | number | Task number to remove |

### Output

```
⚠ This will permanently delete task #5: Implement user login endpoint
? Continue? (y/N)
```

After confirmation:

```
✓ Removed task #5
```

### Examples

**Remove a task:**
```bash
ralph task remove 5
```

**Force remove without confirmation:**
```bash
ralph task remove 5 --force
```

### Use Cases

**Remove duplicate tasks:**
```bash
ralph task remove 6
```

**Remove obsolete tasks:**
```bash
ralph task remove 8
ralph progress add "Removed task 8 - no longer needed"
```

**Clean up after decomposition:**

If Ralph automatically decomposed a task:

```bash
# Original task 5 was decomposed into 5.1, 5.2, 5.3
# The original is kept but can be removed
ralph task remove 5
```

## Task Identification

Tasks can be identified in two ways:

### By Number

Tasks are numbered starting from 1. Use the number shown in `ralph task list`:

```bash
ralph task done 1
ralph task edit 3 --title "New title"
ralph task remove 5
```

Numbers are stable and don't change when tasks are added or removed.

### By Title Substring

Match by any substring of the task title:

```bash
ralph task done "signup"
ralph task done "authentication"
ralph task done "user API"
```

**Matching rules:**

- Case-insensitive
- Matches anywhere in title
- Returns first match if unique
- Prompts if multiple matches

**Examples:**

```bash
# These all match "Implement user signup endpoint"
ralph task done "signup"
ralph task done "user signup"
ralph task done "Implement user"
```

**Multiple matches:**

```bash
ralph task done "user"
```

Output:
```
Multiple tasks match "user":
  [4] Implement user signup endpoint
  [5] Implement user login endpoint
  [6] Create user profile endpoint
  
Please be more specific or use task number.
```

Solution:
```bash
ralph task done "user signup"  # More specific
# or
ralph task done 4  # Use number
```

## JSON Output

All task commands support `--json` for programmatic access.

### Examples

**List tasks:**
```bash
ralph task list --json
```

```json
{
  "tasks": [
    {
      "id": "1",
      "number": 1,
      "title": "Set up Express server",
      "status": "done",
      "completedAt": "2024-01-20T10:15:00Z"
    },
    {
      "id": "2",
      "number": 2,
      "title": "Configure PostgreSQL",
      "status": "done",
      "completedAt": "2024-01-20T10:30:00Z"
    },
    {
      "id": "3",
      "number": 3,
      "title": "Implement user signup",
      "status": "pending"
    }
  ],
  "total": 3,
  "done": 2,
  "pending": 1
}
```

**Current task:**
```bash
ralph task current --json
```

```json
{
  "id": "3",
  "number": 3,
  "title": "Implement user signup",
  "status": "pending"
}
```

**Task details:**
```bash
ralph task show 3 --json
```

```json
{
  "id": "3",
  "number": 3,
  "title": "Implement user signup endpoint",
  "status": "pending",
  "createdAt": "2024-01-20T10:00:00Z",
  "description": "Create POST /api/auth/signup...",
  "steps": [
    "Create signup route handler",
    "Add input validation",
    "Hash password with bcrypt"
  ]
}
```

### Use in Scripts

**Count pending tasks:**
```bash
PENDING=$(ralph task list --json | jq '.pending')
echo "Tasks remaining: $PENDING"
```

**Get current task title:**
```bash
TASK=$(ralph task current --json | jq -r '.title')
echo "Working on: $TASK"
```

**Check if all done:**
```bash
DONE=$(ralph task list --json | jq '.done')
TOTAL=$(ralph task list --json | jq '.total')

if [ "$DONE" -eq "$TOTAL" ]; then
  echo "All tasks complete!"
fi
```

**Export tasks to file:**
```bash
ralph task list --json > tasks.json
```

## Command Aliases

Some commands have shorter aliases:

| Full Command | Alias |
|--------------|-------|
| `ralph task list` | `ralph tasks` |
| `ralph task current` | `ralph current` |

Examples:
```bash
ralph tasks        # Same as ralph task list
ralph current      # Same as ralph task current
```

## Best Practices

### Use Numbers for Reliability

When scripting or in automation, use task numbers instead of titles:

```bash
# Good: Stable reference
ralph task done 4

# Risky: Title might change
ralph task done "signup endpoint"
```

### Use Titles for Convenience

When working interactively, titles are faster:

```bash
# Quick and readable
ralph task done "signup"
```

### Review Before Removing

Always review a task before removing:

```bash
ralph task show 5
ralph task remove 5
```

### Document Changes

When manually marking tasks done or removing them, add a progress note:

```bash
ralph task done 5
ralph progress add "Completed manually - agent was stuck"

ralph task remove 6
ralph progress add "Removed task 6 - no longer needed"
```

## Common Workflows

### Review and Start Work

```bash
# See all tasks
ralph task list

# Check what's next
ralph task current

# See details
ralph task show 4

# Start working
ralph run
```

### Manual Task Management

```bash
# Complete a task yourself
# ... do the work ...
git add .
git commit -m "feat: implement feature"

# Mark it done
ralph task done 4
ralph progress add "Completed manually"

# Continue with Ralph
ralph run
```

### Fix Task Order

```bash
# View current state
ralph task list

# Reset incorrectly completed tasks
ralph task undone 5
ralph task undone 6

# Verify order
ralph task list

# Resume
ralph run
```

### Refine PRD During Development

```bash
# Add forgotten task
ralph task add --title "Add error handling"

# Edit vague task
ralph task edit 5 --title "Implement JWT authentication with refresh tokens"

# Remove obsolete task
ralph task remove 8

# View updated PRD
ralph task list
```

## Next Steps

- [Progress Commands](/docs/cli-reference/progress-commands/) — Recording progress notes
- [Dependency Commands](/docs/cli-reference/dependency-commands/) — Managing task dependencies
- [Session Commands](/docs/cli-reference/session-commands/) — Managing sessions
- [Core Concepts: Tasks](/docs/core-concepts/tasks/) — Deep dive into task management
