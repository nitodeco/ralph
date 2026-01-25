---
title: Tasks
description: Learn how tasks work in Ralph, including the task lifecycle, status management, automatic decomposition, progress notes, and best practices for writing effective tasks.
sidebar:
  order: 2
  label: Tasks
---

# Tasks

Tasks are the fundamental unit of work in Ralph. Each task represents a discrete piece of development work that an AI agent can complete in a single iteration. Understanding tasks is essential to using Ralph effectively.

## What is a Task?

A task is a single, well-defined piece of work with:

- **Clear objective** — What needs to be built or changed
- **Completion criteria** — How to know when it's done
- **Appropriate scope** — Completable in one iteration (5-30 minutes)

Example tasks:

```
✓ Create user database schema with Prisma
✓ Implement POST /api/auth/signup endpoint
✓ Add JWT token generation utility
→ Create authentication middleware
  Protect API routes with auth middleware
```

## Task Lifecycle

Tasks move through a simple lifecycle:

```
Created (pending)
    ↓
Assigned to iteration
    ↓
In progress (agent working)
    ↓
Completed (done)
```

### Task States

| State | Description | Indicator |
|-------|-------------|-----------|
| **Pending** | Not yet started | `[ ]` |
| **In Progress** | Currently being worked on | `[→]` |
| **Done** | Completed successfully | `[✓]` |

## Task Management Commands

### List All Tasks

View all tasks with their status:

```bash
ralph task list
```

Output:

```
[✓] 1. Set up Express server with TypeScript
[✓] 2. Configure PostgreSQL database connection
[✓] 3. Create user authentication schema
[→] 4. Implement user signup endpoint
[ ] 5. Implement user login endpoint
[ ] 6. Add JWT token generation
[ ] 7. Create authentication middleware
[ ] 8. Protect API routes with middleware

Total: 8 | Done: 3 | Pending: 5
```

With JSON output:

```bash
ralph task list --json
```

### Show Current Task

See which task Ralph will work on next:

```bash
ralph task current
```

Output:

```
Current task: [4] Implement user signup endpoint
```

If all tasks are complete:

```
All tasks complete! 🎉
```

### Mark Task Done

The AI agent automatically calls this when completing a task:

```bash
ralph task done 4
```

You can also mark tasks done manually:

```bash
# By number
ralph task done 4

# By title (partial match)
ralph task done "signup endpoint"
```

### Mark Task Undone

Reset a task to pending status:

```bash
ralph task undone 4
```

Use cases:
- Task wasn't completed correctly
- You want to retry with different approach
- Reordering task execution

### Add New Task

Add tasks during development:

```bash
ralph task add --title "Add rate limiting middleware"
```

With description and steps:

```bash
ralph task add \
  --title "Add rate limiting" \
  --description "Protect API from abuse" \
  --steps "Install express-rate-limit" \
  --steps "Configure rate limits" \
  --steps "Apply to auth endpoints"
```

### Edit Existing Task

Update task details:

```bash
ralph task edit 4 --title "Implement user signup with email verification"
```

### Show Task Details

View full task information:

```bash
ralph task show 4
```

Output:

```
Task #4
Title: Implement user signup endpoint
Status: pending
Created: 2024-01-20 10:00:00

Description:
Create POST /api/auth/signup endpoint that accepts email and password,
validates input, hashes password, and creates user in database.

Steps:
1. Create signup route handler
2. Add input validation (email format, password strength)
3. Hash password with bcrypt
4. Save user to database
5. Return JWT token
```

### Remove Task

Delete a task:

```bash
ralph task remove 4
```

Confirm before deletion:

```
⚠ This will permanently delete task #4: Implement user signup endpoint
? Continue? (y/N)
```

## How Tasks Are Processed

During a session, Ralph processes tasks sequentially:

### 1. Task Selection

```bash
# Ralph runs internally
ralph task current
```

Finds the first pending task in the PRD.

### 2. Context Preparation

Ralph gathers context for the agent:

- Task title and description
- Previous task completions
- Progress notes from earlier iterations
- Project guardrails
- Custom instructions

### 3. Agent Execution

Ralph spawns the AI agent with the task:

```
Task: [4] Implement user signup endpoint

Context:
- Completed: Set up Express, Configure PostgreSQL, Create user schema
- Progress: Database ready, user model defined

Instructions:
- When complete: ralph task done 4
- Add notes: ralph progress add "description"
```

### 4. Completion Detection

Ralph monitors for completion signals:

```bash
# Agent calls when done
ralph task done 4
ralph progress add "Created signup endpoint with validation and password hashing"
```

### 5. Automatic Commit

Ralph commits the changes:

```bash
git add .
git commit -m "feat: implement user signup endpoint"
```

### 6. Next Task

Ralph moves to the next pending task and repeats.

## Task Decomposition

Sometimes a task is too complex for a single iteration. Ralph handles this automatically.

### Automatic Decomposition

When the agent detects a task is too large:

1. Agent outputs a `DECOMPOSE_TASK` marker
2. Provides a list of subtasks
3. Ralph replaces the original task with subtasks
4. Continues with the first subtask

Example:

```
Original task:
[ ] 4. Build user authentication system

Decomposed into:
[ ] 4.1. Create user database schema
[ ] 4.2. Implement signup endpoint
[ ] 4.3. Implement login endpoint
[ ] 4.4. Add JWT token generation
[ ] 4.5. Create authentication middleware
```

### Manual Decomposition

You can also manually break down tasks:

```bash
# Remove the large task
ralph task remove 4

# Add specific subtasks
ralph task add --title "Create user database schema"
ralph task add --title "Implement signup endpoint"
ralph task add --title "Implement login endpoint"
```

## Progress Notes

Tasks track what was done, but progress notes capture how and why.

### Adding Progress Notes

The agent adds notes during execution:

```bash
ralph progress add "Created signup endpoint with bcrypt password hashing and email validation"
```

You can also add notes manually:

```bash
ralph progress add "Fixed validation bug found during testing"
```

### Viewing Progress

```bash
ralph progress
```

Output:

```
Progress Notes:

[5 minutes ago]
Created signup endpoint with bcrypt password hashing and email validation.
Endpoint accepts email and password, validates format, hashes password,
saves to database, and returns JWT token.

[2 minutes ago]
Added comprehensive input validation for signup endpoint.
Email must be valid format, password must be 8+ characters.
```

### Clearing Progress

Start fresh (archives old notes):

```bash
ralph progress clear
```

## Task Best Practices

### 1. Appropriate Scope

**Too Large:**
```
Build complete authentication system
```

**Too Small:**
```
Import bcrypt library
```

**Just Right:**
```
Implement user signup endpoint with validation and password hashing
```

### 2. Clear and Specific

**Vague:**
```
Add authentication
```

**Specific:**
```
Implement JWT-based authentication with signup and login endpoints
```

### 3. Include Technical Details

**Missing Context:**
```
Add database
```

**With Context:**
```
Set up PostgreSQL database with Prisma ORM and create initial migration
```

### 4. Action-Oriented

Start with action verbs:

```
✓ Create user authentication schema
✓ Implement password reset flow
✓ Add rate limiting to API endpoints
✓ Refactor database queries to use transactions
```

### 5. Self-Contained

Each task should be independently completable:

**Bad (depends on future work):**
```
1. Create API endpoint (will add validation later)
2. Add validation to endpoint
```

**Good (complete in one task):**
```
1. Create API endpoint with input validation and error handling
```

## Real-World Task Examples

### REST API Development

```
1. Set up Express server with TypeScript and basic middleware
2. Configure PostgreSQL database with Prisma ORM
3. Create user model and authentication schema
4. Implement POST /api/auth/signup endpoint
5. Implement POST /api/auth/login endpoint
6. Add JWT token generation and validation utilities
7. Create authentication middleware for protected routes
8. Implement CRUD endpoints for main resource
9. Add input validation and error handling
10. Write integration tests for API endpoints
```

### Frontend Feature

```
1. Create feature component structure and routing
2. Implement UI layout with responsive design
3. Add form components with validation
4. Integrate with backend API endpoints
5. Add loading states and error handling
6. Implement optimistic updates for better UX
7. Add unit tests for component logic
```

### Database Migration

```
1. Design new database schema for feature
2. Create Prisma migration files
3. Write data migration script for existing records
4. Update API endpoints to use new schema
5. Update frontend to handle new data structure
6. Add backward compatibility layer
7. Test migration on staging environment
```

## Task Dependencies

Some tasks depend on others being completed first. Ralph processes tasks in order, so place dependent tasks after their prerequisites.

### Example: Authentication Flow

```
1. Create user schema                    ← Foundation
2. Implement signup endpoint             ← Uses schema
3. Implement login endpoint              ← Uses schema
4. Add JWT token generation              ← Uses signup/login
5. Create authentication middleware      ← Uses JWT
6. Protect API routes                    ← Uses middleware
```

### Managing Dependencies

For complex dependencies, use the dependency commands:

```bash
# Set dependencies for a task
ralph dependency set 6 5

# View dependency graph
ralph dependency graph

# See which tasks are ready to start
ralph dependency ready
```

## Troubleshooting Tasks

### Task Not Completing

**Problem:** Agent works but doesn't call `ralph task done`

**Solutions:**
1. Check if agent has access to `ralph` command
2. Verify task is clear enough for agent to understand
3. Review logs for errors: `~/.ralph/projects/<project>/logs/latest.log`

### Task Keeps Failing

**Problem:** Same task fails repeatedly

**Solutions:**
1. Break task into smaller subtasks
2. Add more context via guardrails
3. Manually complete and move on: `ralph task done <n>`

### Wrong Task Being Worked On

**Problem:** Agent working on unexpected task

**Solution:** Check current task and fix status:

```bash
ralph task current
ralph task undone <n>  # Reset incorrect completions
```

## Next Steps

- [Sessions & Iterations](/docs/core-concepts/sessions-and-iterations/) — Understand how tasks are executed
- [Verification & Retries](/docs/core-concepts/verification-and-retries/) — How Ralph handles task failures
- [CLI Reference: Task Commands](/docs/cli-reference/task-commands/) — Complete command documentation
