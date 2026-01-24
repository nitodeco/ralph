---
title: guardrails Commands
description: CLI reference for Ralph guardrails management commands.
sidebar:
  order: 5
  label: guardrails
---

# guardrails Commands

The `guardrails` command group manages prompt guardrails that guide the AI agent's behavior.

Guardrails are additional instructions that get injected into every agent prompt, helping prevent common mistakes and enforce project standards.

## `ralph guardrails show`

Display current guardrails.

```bash
ralph guardrails show
```

**Output:**

```
Guardrails:

1. Always run `bun check` before committing
2. Never modify files in the vendor/ directory
3. Use TypeScript strict mode
```

## `ralph guardrails add`

Add a new guardrail.

```bash
ralph guardrails add "Always add tests for new functions"
```

Guardrails are numbered in the order they're added.

## `ralph guardrails remove`

Remove a guardrail by number.

```bash
ralph guardrails remove 2
```

## `ralph guardrails clear`

Remove all guardrails.

```bash
ralph guardrails clear
```

## Best Practices

### Be Specific

```bash
# Good
ralph guardrails add "Run 'bun run typecheck' before marking tasks complete"

# Too vague
ralph guardrails add "Check types"
```

### Focus on Prevention

Use guardrails to prevent mistakes you've seen the agent make:

```bash
ralph guardrails add "Never delete test files"
ralph guardrails add "Do not modify the database schema without migration"
```

### Keep It Manageable

Too many guardrails can overwhelm the agent. Focus on the most important ones:

- Code quality requirements
- Files/directories to avoid
- Required verification steps
- Project-specific patterns

## Storage

Guardrails are stored per-project in:

```
~/.ralph/projects/<project>/guardrails.json
```

## Related

- [Verification & Retries](/ralph/docs/core-concepts/verification-and-retries/) - How guardrails fit into verification
