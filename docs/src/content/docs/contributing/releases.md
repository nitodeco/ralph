---
title: Releases
description: How Ralph releases work using Changesets for version management. Learn to add changesets, follow commit conventions, and understand the automated release process.
sidebar:
  order: 2
  label: Releases
---

# Releases

Ralph uses [Changesets](https://github.com/changesets/changesets) for version management and release automation.

## Overview

Changesets is a tool that:

- Tracks changes across pull requests
- Automates version bumps
- Generates changelogs
- Creates releases

## Adding a Changeset

When you make changes that should be released:

```bash
bun changeset
```

You'll be prompted to:

1. Select the type of change:
   - `patch`: Bug fixes, minor improvements
   - `minor`: New features, non-breaking changes
   - `major`: Breaking changes

2. Write a summary of your changes

This creates a file in `.changeset/`:

```
.changeset/
└── friendly-name-1234.md
```

### Changeset Content

The generated file looks like:

```markdown
---
"ralph": minor
---

Add session memory export feature
```

## When to Add Changesets

**Add a changeset for:**

- New features
- Bug fixes
- Performance improvements
- Behavior changes
- API changes

**Skip changesets for:**

- Documentation-only changes
- CI/tooling updates
- Test-only changes
- Refactoring with no behavior change

## Commit Convention

Ralph follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add session memory export
fix: correct timeout handling
docs: update installation guide
chore: update dependencies
```

## Release Process

Releases happen automatically:

1. PRs with changesets are merged to `main`
2. A "Version Packages" PR is created/updated
3. When that PR is merged, releases are published

### Manual Release

Maintainers can trigger releases manually if needed:

```bash
bun changeset version
bun changeset publish
```

## Version Bumping

Changesets automatically determines the version bump:

- If any `major` changeset: bump major
- Else if any `minor` changeset: bump minor
- Else: bump patch

## Changelog

Changesets generates `CHANGELOG.md` from changeset summaries. Write clear, user-facing descriptions:

**Good:**

```
Add ability to export session memory as markdown
```

**Less good:**

```
implement SessionMemoryService.export()
```

## Pre-release Versions

For testing before a full release, use pre-release mode:

```bash
bun changeset pre enter beta
# make changes
bun changeset
bun changeset version
# versions become 1.0.0-beta.0, etc.
bun changeset pre exit
```

## Troubleshooting

### "No changesets found"

If your changes need a release, run `bun changeset` to create one.

### Changeset Conflicts

If multiple PRs create changesets, conflicts may occur. Resolve by keeping all changeset files.

### Wrong Version Type

If you selected the wrong change type, edit the changeset file directly:

```markdown
---
"ralph": patch  # change from minor to patch
---
```

## Next Steps

- [Local Development](/docs/contributing/local-development/) — Set up development environment
- [FAQ](/docs/faq/) — Frequently asked questions
