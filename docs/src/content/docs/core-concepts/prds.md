---
title: PRDs
description: Understand how Product Requirements Documents (PRDs) work in Ralph. Learn to write effective tasks, structure projects, and manage task ordering for optimal AI agent execution.
sidebar:
  order: 1
  label: PRDs
---

# Product Requirements Documents (PRDs)

A Product Requirements Document (PRD) is the blueprint for your development session. It contains a structured list of tasks that Ralph orchestrates your AI agent to complete, one at a time, in sequence.

## What is a PRD?

In Ralph, a PRD is a JSON file that defines:

- **Project description** — What you're building and why
- **Tasks** — Ordered list of implementation steps
- **Task status** — Which tasks are pending or completed

Ralph uses the PRD to guide the AI agent through your project systematically, ensuring nothing gets skipped.

## How PRDs Are Created

### Automatic Generation

When you run `ralph init`, Ralph:

1. Prompts you to describe what you want to build
2. Uses AI to analyze your description and generate tasks
3. Creates a structured PRD with 5-15 tasks
4. Saves it to `~/.ralph/projects/<project>/prd.json`

Example initialization:

```bash
ralph init
```

```
? Describe what you want to build:
Build a blog API with user authentication, posts, comments,
and markdown support using Express and PostgreSQL

✓ Generated PRD with 12 tasks
✓ Saved to ~/.ralph/projects/my-blog-api/
```

### Manual Editing

You can also add, edit, or remove tasks using Ralph commands:

```bash
ralph task add --title "Add rate limiting middleware"
ralph task edit 5 --title "Updated task title"
ralph task remove 3
```

## PRD Structure

A PRD file looks like this:

```json
{
  "description": "Build a blog API with user authentication...",
  "tasks": [
    {
      "id": "1",
      "title": "Set up Express server with TypeScript",
      "status": "done",
      "completedAt": "2024-01-20T10:30:00Z"
    },
    {
      "id": "2",
      "title": "Configure PostgreSQL with Prisma ORM",
      "status": "done",
      "completedAt": "2024-01-20T10:45:00Z"
    },
    {
      "id": "3",
      "title": "Create user authentication schema",
      "status": "pending"
    }
  ]
}
```

## Task Anatomy

Each task has these properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique task identifier |
| `title` | string | What needs to be done |
| `status` | `"pending"` \| `"done"` | Completion status |
| `completedAt` | string | ISO timestamp when completed (optional) |

## Writing Effective Tasks

Good tasks are the foundation of successful Ralph sessions. Follow these guidelines:

### 1. Be Specific

**Bad:**

```
Add authentication
```

**Good:**

```
Implement JWT-based authentication with login and signup endpoints
```

**Why:** The AI agent needs enough context to know exactly what to build.

### 2. Keep Tasks Atomic

Each task should be completable in a single iteration (typically 5-30 minutes of AI agent work).

**Bad:**
```
Build the entire user management system
```

**Good:**
```
1. Create user database schema with Prisma
2. Implement POST /api/auth/signup endpoint
3. Implement POST /api/auth/login endpoint
4. Add JWT token generation utility
5. Create authentication middleware
6. Add password hashing with bcrypt
```

**Why:** Smaller tasks are easier to complete, verify, and retry if they fail.

### 3. Include Technical Context

**Bad:**
```
Add database
```

**Good:**

```
Set up PostgreSQL database with Prisma ORM and create initial migration
```

**Why:** Specifying technologies removes ambiguity and ensures consistency.

### 4. Make Tasks Self-Contained

Each task should be completable without depending on future tasks.

**Bad:**

```
1. Create API endpoint (will add validation later)
2. Add validation to the endpoint
```

**Good:**
```
1. Create API endpoint with input validation and error handling
```

**Why:** Self-contained tasks can be verified immediately and don't leave incomplete work.

### 5. Use Action Verbs

Start tasks with clear action verbs:

- **Create** — For new files, schemas, or components
- **Implement** — For features or functionality
- **Add** — For enhancements to existing code
- **Update** — For modifications
- **Fix** — For bugs
- **Refactor** — For code improvements

**Examples:**
```
Create user model with Prisma schema
Implement password reset flow with email verification
Add rate limiting to authentication endpoints
Update API responses to include pagination metadata
Fix CORS configuration for production
Refactor database queries to use transactions
```

## Task Ordering

Ralph processes tasks sequentially in the order they appear. Consider:

### Foundation First

Start with setup and infrastructure:

```
1. Initialize project with TypeScript and Express
2. Configure PostgreSQL database connection
3. Set up environment variables and configuration
```

### Build Dependencies Before Dependents

Complete prerequisite tasks before tasks that use them:

```
1. Create user database schema
2. Implement user authentication endpoints  ← Uses schema
3. Add authentication middleware            ← Uses endpoints
4. Protect API routes with middleware       ← Uses middleware
```

### Group Related Tasks

Keep related functionality together:

```
Authentication Tasks:
1. Create user schema
2. Implement signup endpoint
3. Implement login endpoint
4. Add JWT token generation

Post Management Tasks:
5. Create post schema
6. Implement post CRUD endpoints
7. Add post validation
```

## Managing Tasks

### View All Tasks

```bash
ralph task list
```

Output shows status and progress:

```
[✓] 1. Set up Express server with TypeScript
[✓] 2. Configure PostgreSQL with Prisma ORM
[→] 3. Create user authentication schema
[ ] 4. Implement signup endpoint
[ ] 5. Implement login endpoint

Total: 5 | Done: 2 | Pending: 3
```

### Check Current Task

```bash
ralph task current
```

Shows which task Ralph will work on next:

```
Current task: [3] Create user authentication schema
```

### Mark Tasks Complete

The AI agent automatically calls this when finishing a task:

```bash
ralph task done 3
```

You can also mark tasks done manually if you complete them yourself.

### Mark Tasks Incomplete

To re-process a task:

```bash
ralph task undone 3
```

Use cases:
- Task wasn't completed correctly
- You want to retry with different context
- Changing execution order

### Add New Tasks

Add tasks during development:

```bash
ralph task add --title "Add rate limiting middleware" --description "Use express-rate-limit"
```

### Edit Existing Tasks

Update task details:

```bash
ralph task edit 3 --title "Create user authentication schema with email verification"
```

### Remove Tasks

Delete tasks that are no longer needed:

```bash
ralph task remove 3
```

## PRD Best Practices

### Start with 5-15 Tasks

Too few tasks:
- Tasks become too large and complex
- Higher chance of failure
- Harder to track progress

Too many tasks:
- Overhead of managing many small tasks
- Session takes longer to complete

Sweet spot: 8-12 well-defined tasks for most features.

### Review Generated PRDs

After `ralph init`, always review the generated tasks:

```bash
ralph task list
```

Edit or add tasks as needed before starting:

```bash
ralph task edit 1 --title "Better task description"
ralph task add --title "Additional task I need"
```

### Use Task Decomposition

If a task is too complex, Ralph can automatically decompose it. The AI agent will output a `DECOMPOSE_TASK` marker with subtasks, and Ralph will replace the original task.

You can also manually break down tasks:

```bash
ralph task edit 3 --title "Create user schema"
ralph task add --title "Add user validation rules"
ralph task add --title "Create user migration"
```

### Include Testing Tasks

For production code, include testing:

```
1. Implement user authentication endpoints
2. Write unit tests for authentication logic
3. Write integration tests for auth endpoints
```

### Document Complex Tasks

For tasks requiring specific approaches, add details:

```bash
ralph task add \
  --title "Implement caching layer" \
  --description "Use Redis for caching API responses. Cache user data for 5 minutes, post data for 1 minute."
```

## Common PRD Patterns

### REST API

```
1. Set up Express server with TypeScript
2. Configure database (PostgreSQL + Prisma)
3. Create data models and migrations
4. Implement authentication endpoints
5. Implement resource CRUD endpoints
6. Add input validation and error handling
7. Add API documentation with Swagger
8. Write integration tests
```

### Frontend Application

```
1. Initialize React app with TypeScript
2. Set up routing with React Router
3. Create layout components (header, footer, sidebar)
4. Implement authentication flow
5. Create feature components
6. Add state management (Zustand/Redux)
7. Integrate with backend API
8. Add error boundaries and loading states
```

### Full-Stack Feature

```
1. Design database schema for feature
2. Create backend API endpoints
3. Write backend tests
4. Create frontend components
5. Integrate frontend with API
6. Add frontend validation
7. Write E2E tests
8. Update documentation
```

## Next Steps

- [Tasks](/docs/core-concepts/tasks/) — Deep dive into task management
- [Sessions & Iterations](/docs/core-concepts/sessions-and-iterations/) — Understand how Ralph executes tasks
- [CLI Reference: Task Commands](/docs/cli-reference/task-commands/) — Complete task command reference
