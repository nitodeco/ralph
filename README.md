# Ralph

A CLI tool for long-running PRD-driven development with AI coding agents.

Ralph automates the process of working through a Product Requirements Document (PRD) by orchestrating AI coding agents (Cursor or Claude Code) to complete tasks one at a time.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

## Usage

### Initialize a new project

```bash
ralph init
```

This will interactively create a `prd.json` (or `prd.yaml`), `progress.txt`, and `config.json` in the `.ralph` directory. You'll be prompted to select your preferred AI agent (Cursor or Claude Code).

### Run the agent

```bash
ralph run [iterations]
```

Runs the configured AI agent in a loop, working through tasks in your PRD. Default is 10 iterations.

The agent will:

1. Read `progress.txt` and `prd.json` to understand the current state
2. Find the next incomplete task
3. Implement that task
4. Update `progress.txt` and mark the task as done
5. Commit the changes
6. Repeat until all tasks are complete or iterations are exhausted

## PRD Format

Ralph supports both JSON and YAML formats.

### JSON (prd.json)

```json
{
  "project": "My Project",
  "tasks": [
    {
      "title": "Setup project",
      "description": "Initialize the project structure",
      "steps": [
        "Create package.json",
        "Configure TypeScript"
      ],
      "done": false
    }
  ]
}
```

### YAML (prd.yaml)

```yaml
project: My Project
tasks:
  - title: Setup project
    description: Initialize the project structure
    steps:
      - Create package.json
      - Configure TypeScript
    done: false
```

## Custom Instructions

You can provide project-specific instructions to the agent by creating a `.ralph/instructions.md` file. The contents of this file will be included in the agent prompt.

## Requirements

One of the following AI coding agents must be installed:

- [Cursor CLI](https://docs.cursor.com/cli) - available as `agent` in your PATH
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) - available as `claude` in your PATH

## Development

```bash
# Install dependencies
bun install

# Run in development
bun run dev

# Build binaries
bun run build

# Type check
bun run typecheck
```

## License

MIT
