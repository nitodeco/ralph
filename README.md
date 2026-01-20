# Ralph

<div align="center">

## A CLI tool for long-running PRD-driven development with AI coding agents

[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](https://github.com/nitodeco/ralph)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

![Ralph Screenshot](docs/image.png)

</div>

Ralph automates the process of working through a Product Requirements Document (PRD) by orchestrating AI coding agents (Cursor or Claude Code) to complete tasks one at a time.

## Installation

Install Ralph with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

## Quick Start

### 1. Initialize a new project

```bash
ralph init
```

This will interactively create a `prd.json` (or `prd.yaml`), `progress.txt`, and `config.json` in the `.ralph` directory. You'll be prompted to select your preferred AI agent (Cursor or Claude Code).

### 2. Run the agent

```bash
ralph run [iterations]
```

Runs the configured AI agent in a loop, working through tasks in your PRD. Default is 10 iterations.

**The agent workflow:**

1. Read `progress.txt` and `prd.json` to understand the current state
2. Find the next incomplete task
3. Implement that task
4. Update `progress.txt` and mark the task as done
5. Commit the changes
6. Repeat until all tasks are complete or iterations are exhausted

## PRD Format

Ralph supports both JSON and YAML formats for your Product Requirements Document.

### JSON Format (`prd.json`)

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

### YAML Format (`prd.yaml`)

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

## Configuration

### Custom Instructions

You can provide project-specific instructions to the agent by creating a `.ralph/instructions.md` file. The contents of this file will be included in the agent prompt, allowing you to customize behavior, coding standards, or project-specific guidelines.

## Requirements

One of the following AI coding agents must be installed and available in your PATH:

- **[Cursor CLI](https://docs.cursor.com/cli)** - available as `agent` command
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - available as `claude` command

## Development

Contributions are welcome! To get started with development:

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build binaries
bun run build

# Type check
bun run typecheck
```

## License

MIT
