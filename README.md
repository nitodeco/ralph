# Ralph

A CLI tool for long-running PRD-driven development with Cursor AI.

Ralph automates the process of working through a Product Requirements Document (PRD) by orchestrating the Cursor CLI agent to complete tasks one at a time.

## Installation

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

## Usage

### Initialize a new project

```bash
ralph init
```

This will interactively create a `prd.json` (or `prd.yaml`) and `progress.txt` in your current directory.

### Run the agent

```bash
ralph run [iterations]
```

Runs the Cursor CLI agent in a loop, working through tasks in your PRD. Default is 10 iterations.

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

## Requirements

- [Cursor CLI](https://docs.cursor.com/cli) must be installed and available as `agent` in your PATH

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
