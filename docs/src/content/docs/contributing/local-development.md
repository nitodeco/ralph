---
title: Local Development
description: Set up a local development environment for contributing to Ralph.
sidebar:
  order: 1
  label: Local Development
---

# Local Development

This guide helps you set up a local development environment for contributing to Ralph.

## Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Git](https://git-scm.com/)
- Node.js 18+ (for some tooling)

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/nitodeco/ralph.git
cd ralph
```

### Install Dependencies

```bash
bun install
```

### Run in Development Mode

```bash
bun run dev
```

This runs Ralph directly from source, allowing you to test changes immediately.

## Project Structure

```
ralph/
├── src/
│   ├── index.tsx          # Entry point
│   ├── cli/               # CLI commands and parsing
│   ├── components/        # Ink UI components
│   ├── lib/               # Core logic and services
│   ├── stores/            # State management (Zustand)
│   └── types/             # TypeScript types
├── docs/                  # Documentation site (separate package)
├── scripts/               # Build and utility scripts
└── tests/                 # Test files
```

## Development Workflow

### Make Changes

1. Create a branch:

```bash
git checkout -b feature/your-feature
```

2. Make your changes in `src/`
3. Test locally with `bun run dev`

### Quality Checks

Before committing, run all checks:

```bash
# Format and lint (with auto-fix)
bun run check

# Type checking
bun run typecheck

# Run tests
bun test
```

### Testing

Run the test suite:

```bash
# All tests
bun test

# Specific test file
bun test src/__tests__/lib/config.test.ts

# Watch mode
bun test --watch
```

### Building

Create a production build:

```bash
bun run build
```

This creates binaries in `dist/`.

## Code Style

Ralph uses:

- **Biome** for formatting and linting
- **ESLint** for additional checks
- **TypeScript** strict mode

The `bun run check` command handles formatting and linting automatically.

### Key Conventions

- Use `const` for all variables
- Prefer functional patterns
- Use descriptive variable names
- Follow existing patterns in the codebase

## Adding Commands

New CLI commands go in `src/cli/commands/`:

1. Create a new command file
2. Export the command handler
3. Register in `src/cli/parser.ts`

## Adding Services

Services are in `src/lib/services/`:

1. Create service directory with implementation
2. Export from `src/lib/services/index.ts`
3. Register in bootstrap if needed

## Path Aliases

The project uses path aliases:

```typescript
import { something } from "@/lib/something.ts";
```

`@/` maps to `src/`.

## Debugging

### VS Code

Launch configurations are provided in `.vscode/launch.json`.

### Console Logging

Use standard `console.log` during development. Remove before committing.

### Inspect State

The Ink UI shows current state. Use `ralph status` to debug session state.

## Next Steps

- [Releases](/ralph/docs/contributing/releases/) — How releases work
- [CLI Reference](/ralph/docs/cli-reference/overview/) — Understand the CLI structure
