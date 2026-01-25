---
title: Progress Commands
description: Reference for Ralph progress tracking commands. Learn how to view, add, and clear progress notes that provide context for AI agents and track development history.
sidebar:
  order: 3
  label: progress
---

# Progress Commands

Progress commands manage notes that track what has been accomplished during a session. These provide context for the AI agent and help you understand what happened.

## ralph progress

Show all progress notes.

```bash
ralph progress
```

Alias: `ralph progress show`

**Output:**

```
Progress:

1. [2024-01-15 10:30] Set up TypeScript configuration
2. [2024-01-15 10:45] Added Prisma schema for users
3. [2024-01-15 11:00] Implemented user registration endpoint
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

## ralph progress add

Add a new progress note.

```bash
ralph progress add "Completed user authentication, all tests passing"
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<text>` | The progress note text |

**Behavior:**

- Adds a timestamped note to the progress log
- Notes persist across sessions
- Used by AI agents to record what they've done

**Usage by AI agents:**

The AI agent calls this command to record progress, giving context for future iterations:

```bash
ralph progress add "Fixed type errors in UserService, refactored to use dependency injection"
```

## ralph progress clear

Remove all progress notes.

```bash
ralph progress clear
```

**Use cases:**

- Start fresh after completing a major milestone
- Reset for a new development phase
- Clean up before archiving

**Safety:**

Progress notes are automatically archived before clearing when you run `ralph archive` or `ralph clear`.

## How Progress Notes Are Used

### During Sessions

Progress notes provide context to the AI agent at the start of each iteration. This helps the agent:

- Understand what has already been done
- Avoid repeating work
- Build on previous progress

### For Retries

When an iteration fails and retries, progress notes help the agent understand the state of the project.

### For Review

After a session, progress notes give you a log of what was accomplished:

```bash
ralph progress
```

## Best Practices

### Be Specific

Good progress notes explain what was done and why:

```bash
ralph progress add "Added user validation middleware to protect API endpoints"
```

### Record Decisions

Note important decisions made during implementation:

```bash
ralph progress add "Using JWT for auth instead of sessions for stateless API"
```

### Note Blockers

If something was skipped or blocked:

```bash
ralph progress add "Skipped email verification - needs SMTP config"
```

## JSON Output

```bash
ralph progress --json
```

```json
{
  "notes": [
    {
      "timestamp": "2024-01-15T10:30:00Z",
      "text": "Set up TypeScript configuration"
    },
    {
      "timestamp": "2024-01-15T10:45:00Z",
      "text": "Added Prisma schema for users"
    }
  ]
}
```

## Next Steps

- [Session Commands](/docs/cli-reference/session-commands/) — Managing session state
- [Guardrails Commands](/docs/cli-reference/guardrails-commands/) — Setting project guardrails
