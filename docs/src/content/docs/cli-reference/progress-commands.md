---
title: progress Commands
description: CLI reference for Ralph progress tracking commands.
sidebar:
  order: 3
  label: progress
---

# progress Commands

The `progress` command group manages progress notes for your session.

Progress notes are timestamped entries that record what's been accomplished. They provide context across sessions and help you understand what happened while Ralph was running.

## `ralph progress show`

Display all progress notes for the current session.

```bash
ralph progress show
```

**Output:**

```
Progress:

[2024-01-15 10:30] Created user model with email and password fields
[2024-01-15 10:45] Implemented bcrypt password hashing
[2024-01-15 11:00] Added login endpoint with JWT token generation

3 notes
```

## `ralph progress add`

Add a progress note manually.

```bash
ralph progress add "Refactored auth middleware for better error handling"
```

The note is timestamped automatically.

### Multi-word Notes

Wrap your note in quotes:

```bash
ralph progress add "Fixed bug where login failed for users with special characters in password"
```

## Automatic Progress Notes

Ralph automatically adds progress notes when:

- A task is marked complete
- The agent reports significant progress
- An iteration succeeds or fails

You don't need to manually track everything—Ralph does most of it automatically.

## Progress Persistence

Progress notes are stored in your project's Ralph directory:

```
~/.ralph/projects/<project>/session.json
```

They persist across CLI sessions and can be reviewed anytime.

## Use Cases

Progress notes are useful for:

- **Handoffs**: See what was done before resuming work
- **Debugging**: Understand what happened when something went wrong
- **Documentation**: Generate changelogs or status updates

## Related

- [Sessions](/ralph/docs/core-concepts/sessions-and-iterations/) - How progress fits into sessions
