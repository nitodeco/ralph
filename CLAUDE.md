# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralph is a CLI tool for long-running PRD-driven development with Cursor CLI. It orchestrates AI agent sessions that work through tasks defined in a PRD (Product Requirements Document) file, with features like automatic retries, task decomposition, verification, and session memory.

## Commands

```bash
# Development
bun run dev                    # Run the CLI directly
bun run src/index.tsx          # Alternative: run entry point

# Quality checks (run after changes)
bun run check                  # Format + lint + fix (biome + eslint)
bun run typecheck              # TypeScript type checking

# Testing
bun test                       # Run all tests
bun test src/__tests__/lib/config.test.ts  # Run single test file
bun test --watch               # Watch mode

# Build
bun run build                  # Production build via scripts/build.ts
```

## Ralph CLI Commands

These commands manage PRD tasks and progress:

```bash
ralph task list              # List all tasks with completion status
ralph task current           # Show the next pending task
ralph task done <n>          # Mark task as complete (by number or title)
ralph task undone <n>        # Mark task as not done
ralph progress add "<text>"  # Add a progress note
ralph progress show          # Display progress notes
```

## Architecture

### Entry Point & CLI Flow
- `src/index.tsx` - Main entry, parses args, routes to commands or renders Ink components
- `src/cli/parser.ts` - Argument parsing for all CLI commands
- `src/cli/commands/` - Individual command handlers (status, config, guardrails, etc.)

### Core Orchestration
- `src/stores/orchestrator.ts` - `SessionOrchestrator` class manages the entire session lifecycle: starting/resuming sessions, handling iteration callbacks, coordinating between agent runs and verification
- `src/stores/agentStore.ts` - Zustand store for agent execution state, spawns `AgentRunner`
- `src/stores/appStore.ts` - Application state (PRD, session, current view)
- `src/stores/iterationStore.ts` - Tracks iteration progress and timing

### Agent Execution
- `src/lib/agent.ts` - `AgentRunner` class handles spawning the agent process (Cursor CLI), streaming output, timeout/stuck detection, retry logic with context injection
- `src/lib/agent-stream.ts` - Parses JSON streaming output from Cursor CLI
- `src/lib/services/AgentProcessManager.ts` - Singleton managing the active agent subprocess

### Service Layer (Dependency Injection)
Services are bootstrapped at startup via `src/lib/services/bootstrap.ts` and accessed through `src/lib/services/container.ts`:
- `ProjectRegistryService` - Multi-project support, path resolution, stores data in `~/.ralph/projects/`
- `ConfigService` - Layered config (global + project-level)
- `PrdService` - PRD file loading/parsing
- `GuardrailsService` - Prompt guardrails management
- `SessionService` - Session persistence
- `SessionMemoryService` - Cross-session learning/memory

### Event-Driven Communication
- `src/lib/events.ts` - Event bus (`agent:start`, `agent:complete`, `agent:error`, `session:*` events)
- Handlers in `src/lib/handlers/` subscribe to events for verification, decomposition, learning

### UI Layer (Ink/React)
- `src/components/RunApp.tsx` - Main runtime UI
- `src/components/ViewRouter.tsx` - Routes between different views
- `src/components/views/` - Individual view components

## Key Patterns

### Path Aliases
```typescript
import { something } from "@/lib/something.ts";  // src/lib/something.ts
import { Component } from "@/components/index.ts";
```

### Service Access
```typescript
import { getConfigService, getPrdService } from "@/lib/services/index.ts";
const config = getConfigService().get();
```

### Testing Services
```typescript
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
beforeEach(() => bootstrapTestServices({ config: { get: () => mockConfig } }));
afterEach(() => teardownTestServices());
```

## Project Storage Structure

```
~/.ralph/                      # Global Ralph directory
├── config.json                # Global config
├── registry.json              # Project registry
└── projects/                  # Per-project storage
    └── <project-folder>/      # Named by git remote or path
        ├── config.json        # Project-specific config
        ├── prd.md             # PRD file
        ├── session.json       # Active session state
        ├── session-memory.json
        ├── guardrails.json
        └── logs/              # Iteration logs
```

## Type System

- Types are exported from `src/types.ts` (re-exports from `src/types/`)
- Service types defined alongside implementations in `src/lib/services/*/types.ts`
