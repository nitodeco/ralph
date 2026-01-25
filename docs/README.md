# Ralph Documentation Site

Ralph’s documentation site, built with Astro, Tailwind and bun.

## Prerequisites

- [Bun](https://bun.sh/)

## Quick start

```bash
bun install
bun run dev
```

Open `http://localhost:4321/`.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start dev server |
| `bun run build` | Production build (includes search indexing) |
| `bun run preview` | Preview production build |
| `bun run check` | Astro checks |

## Editing docs

- Pages live in `src/content/docs/` (Markdown).
- Use root-relative links, e.g. `/docs/getting-started/installation/`.
- Images should be served from `public/` and referenced as `/images/...`.

Minimal frontmatter:

```markdown
---
title: Page title
description: Short description for SEO
sidebar:
  order: 1
---
```

## Changelog

`/changelog/` is rendered from the repository root `CHANGELOG.md`. Update that file, not docs content.

## Deployment

Deployed to GitHub Pages on pushes to `main` via `.github/workflows/docs.yml`.
