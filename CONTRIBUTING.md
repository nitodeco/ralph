# Contributing to Ralph

Thank you for your interest in contributing to Ralph!

## Code Quality Requirements

Before submitting a pull request, ensure all checks pass:

| Command | Description |
|---------|-------------|
| `bun run check` | Format and lint (auto-fixes issues) |
| `bun run typecheck` | TypeScript type checking |
| `bun test` | Run all tests |
| `bun run build` | Production build |

CI runs `bun run check:ci` which checks without auto-fixing, so run `bun run check` locally to fix issues before committing.

## Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commits are validated using commitlint.

## Pull Request Process

1. Create a branch from `main`:

   ```bash
   git checkout -b feature/<description>
   ```

2. Make your changes and ensure all checks pass.

3. Add a changeset if your changes affect the public API or user experience:

   ```bash
   bun changeset # Make sure to use the correct semver level (patch/minor/major)
   ```

4. Commit your changes following the commit message convention.

5. Push your branch and open a pull request against `main`.

6. Ensure CI passes and address any review feedback.

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management. When making changes that should be included in the changelog:

1. Run `bun run changeset`
2. Select the type of change (patch/minor/major)
3. Write a summary of your changes
4. Commit the generated changeset file

Not all changes require a changeset. Skip for:

- Documentation-only changes
- CI/tooling changes
- Test-only changes
