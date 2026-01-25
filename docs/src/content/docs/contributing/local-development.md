---
title: Local Development
description: Set up a local development environment for contributing to Ralph. Clone the repo, install dependencies with Bun, run quality checks, and understand the project structure.
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
│   ├── hooks/             # React hooks
│   ├── lib/               # Core logic and services
│   │   ├── handlers/      # Event handlers (verification, decomposition, etc.)
│   │   └── services/      # Service layer (DI container)
│   ├── stores/            # State management (Zustand)
│   └── types/             # TypeScript types
├── docs/                  # Documentation site (separate package)
├── scripts/               # Build and utility scripts
└── src/__tests__/         # Test files
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

Services follow a consistent pattern in `src/lib/services/`:

1. Create a service directory (e.g., `src/lib/services/my-service/`)
2. Add `types.ts` for interfaces and types
3. Add `implementation.ts` with a factory function (e.g., `createMyService()`)
4. Add `index.ts` to re-export public API
5. Register in `src/lib/services/container.ts`
6. Add to bootstrap in `src/lib/services/bootstrap.ts`
7. Export from `src/lib/services/index.ts`

Example service structure:
```
src/lib/services/my-service/
├── types.ts           # MyService interface, config types
├── implementation.ts  # createMyService() factory
└── index.ts           # Re-exports
```

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

- [Releases](/docs/contributing/releases/) — How releases work
- [CLI Reference](/docs/cli-reference/overview/) — Understand the CLI structure
