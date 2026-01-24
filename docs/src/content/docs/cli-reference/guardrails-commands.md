---
title: Guardrails Commands
description: Reference for Ralph guardrails management commands.
sidebar:
  order: 5
  label: guardrails
---

# Guardrails Commands

Guardrails are rules and instructions that constrain the AI agent's behavior. They help ensure the agent follows your project's coding standards and avoids certain patterns.

## ralph guardrails

List all configured guardrails.

```bash
ralph guardrails
```

Alias: `ralph guardrails list`

**Output:**

```
Guardrails:

[✓] 1. Always use TypeScript strict mode
[✓] 2. Never commit .env files
[ ] 3. Use Prisma for database access (disabled)
```

**Options:**

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |

## ralph guardrails add

Add a new guardrail.

```bash
ralph guardrails add "Always use async/await instead of .then()"
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<text>` | The guardrail instruction |

**Examples:**

```bash
ralph guardrails add "Use functional React components, no class components"
ralph guardrails add "All API endpoints must validate input with Zod"
ralph guardrails add "Never use any type, always provide explicit types"
```

## ralph guardrails remove

Remove a guardrail by its ID.

```bash
ralph guardrails remove 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | The guardrail number |

## ralph guardrails toggle

Enable or disable a guardrail.

```bash
ralph guardrails toggle 3
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<id>` | The guardrail number |

Disabled guardrails are not included in the agent prompt but remain in your configuration for easy re-enabling.

## ralph guardrails generate

Auto-generate guardrails from codebase analysis.

```bash
ralph guardrails generate
```

Analyzes your codebase to suggest guardrails based on:

- Detected frameworks and libraries
- Existing patterns in code
- Configuration files (tsconfig, eslint, etc.)

**Options:**

| Option | Description |
|--------|-------------|
| `--apply` | Immediately add generated guardrails |

**Example:**

```bash
# Review suggestions first
ralph guardrails generate

# Auto-apply suggestions
ralph guardrails generate --apply
```

## How Guardrails Work

Guardrails are injected into the AI agent prompt at the start of each iteration:

```
## Project Guardrails

You must follow these rules:
1. Always use TypeScript strict mode
2. Never commit .env files
3. Use functional React components
```

The agent sees these instructions and follows them when implementing tasks.

## Guardrail Storage

Guardrails are stored in `~/.ralph/projects/<project>/guardrails.json`:

```json
{
  "guardrails": [
    {"id": 1, "text": "Always use TypeScript strict mode", "enabled": true},
    {"id": 2, "text": "Never commit .env files", "enabled": true}
  ]
}
```

## Best Practices

### Be Specific

Vague guardrails don't help:

```bash
# Bad
ralph guardrails add "Write good code"

# Good
ralph guardrails add "Use early returns to reduce nesting, max 2 levels deep"
```

### Include Context

Explain why when it helps:

```bash
ralph guardrails add "Use Bun instead of npm - this is a Bun project"
```

### Don't Over-constrain

Too many guardrails slow down the agent and can cause conflicts. Focus on important rules.

## Next Steps

- [GitHub Commands](/ralph/docs/cli-reference/github-commands/) — GitHub integration
- [Configuration](/ralph/docs/configuration/overview/) — Full configuration reference
