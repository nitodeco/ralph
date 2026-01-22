---
"ralph": minor
---

feat: add auto-guardrail generation from codebase analysis

Added a new `ralph guardrails generate` command that analyzes the current project's codebase and automatically generates relevant guardrails based on detected patterns.

## Features

- Detects package manager (npm, yarn, pnpm, bun)
- Detects TypeScript usage
- Detects test frameworks (jest, vitest, mocha, bun test)
- Detects linters (eslint, biome)
- Detects formatters (prettier, biome)
- Detects frameworks (React, Next.js, Vue, Svelte, Angular)
- Detects build tools (Vite, Webpack, esbuild, Parcel)
- Detects git hooks (husky, lint-staged, lefthook)
- Detects CI configuration (GitHub Actions, GitLab CI, CircleCI, etc.)
- Detects monorepo configurations (workspaces, pnpm-workspace, turbo, nx, lerna)
- Detects npm scripts (build, test, lint, format, typecheck)

## Usage

```bash
# View suggested guardrails without applying
ralph guardrails generate

# View as JSON
ralph guardrails generate --json

# Generate and immediately add guardrails
ralph guardrails generate --apply
```

