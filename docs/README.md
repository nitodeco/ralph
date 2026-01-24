# Ralph Documentation Site

This is the documentation site for Ralph, built with Astro, Tailwind CSS, and Bun.

## Prerequisites

- [Bun](https://bun.sh/) (latest version)

## Getting Started

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

The site will be available at `http://localhost:4321/ralph/`.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start development server |
| `bun run build` | Build production site (includes Pagefind indexing) |
| `bun run preview` | Preview production build locally |
| `bun run check` | Run Astro type checking |

## Project Structure

```
docs/
├── src/
│   ├── components/     # Astro/React components
│   ├── content/
│   │   └── docs/       # Markdown documentation pages
│   ├── layouts/        # Page layouts
│   ├── pages/          # Route pages
│   └── styles/         # Global styles
├── public/
│   ├── favicon/        # Favicon assets
│   └── og/             # Open Graph images
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
└── package.json
```

## Adding Documentation Pages

### Creating a New Page

1. Create a new `.md` file in the appropriate section under `src/content/docs/`:

```
src/content/docs/
├── getting-started/
├── core-concepts/
├── cli-reference/
├── configuration/
├── github-integration/
├── troubleshooting/
├── contributing/
└── faq/
```

2. Add the required frontmatter at the top of the file:

```markdown
---
title: Your Page Title
description: A brief description of the page content (used for SEO).
sidebar:
  order: 1
  label: Sidebar Label
---

# Your Page Title

Content goes here...
```

### Frontmatter Schema

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | Page title (used in browser tab and headings) |
| `description` | string | Yes | Page description (used for meta tags and SEO) |
| `sidebar.order` | number | Yes | Sort order within the section (lower numbers appear first) |
| `sidebar.label` | string | No | Custom label for sidebar navigation (defaults to `title`) |
| `tags` | string[] | No | Tags for categorization |
| `keywords` | string[] | No | Additional SEO keywords |
| `canonical` | string | No | Custom canonical URL (rarely needed) |

### Internal Links

Use absolute paths with the `/ralph/` base path:

```markdown
[Link text](/ralph/docs/getting-started/installation/)
```

### Using Components

Import and use custom components in Markdown:

```markdown
import { Callout } from '@/components/Callout.astro';

<Callout type="info">
  This is an informational callout.
</Callout>
```

Available callout types: `info`, `warn`, `danger`, `success`

## Adding Images

### Image Location

Place images in `public/` for static assets or import them directly in components.

For documentation images, add them to a logical location in `public/`:

```
public/
├── og/          # Open Graph images (1200x630)
├── favicon/     # Favicon assets
└── images/      # Documentation images (if needed)
```

### Image Optimization

- **Format**: Prefer WebP or AVIF for better compression
- **Size**: Optimize images before adding them to the repository
- **Dimensions**: Use appropriate dimensions for the context (don't serve oversized images)

For generating optimized images, you can use the asset generation script:

```bash
bun run generate-assets
```

### Referencing Images

In Markdown:

```markdown
![Alt text](/ralph/images/example.webp)
```

In components:

```astro
<img src="/ralph/images/example.webp" alt="Description" />
```

## Updating llms.txt

The `/llms.txt` file helps LLMs understand and navigate the documentation. It's generated from `src/pages/llms.txt.ts`.

### When to Update

Update `llms.txt` when:

- Adding new major documentation sections
- Changing documentation URLs
- Adding important entry points

### How to Update

1. Edit `src/pages/llms.txt.ts`
2. Update the `LLMS_TXT_CONTENT` constant with the new URLs
3. Ensure all URLs include the `/ralph/` base path

Example structure:

```typescript
const LLMS_TXT_CONTENT = `Project: Ralph

Ralph is a CLI tool for...

Start here:
- /ralph/docs/

Best starting points:
- /ralph/docs/getting-started/introduction/
- /ralph/docs/new-section/important-page/

Notes:
- This site is fully static.
`;
```

## Changelog

The changelog at `/changelog/` is automatically rendered from the root `CHANGELOG.md` file. Do not edit changelog content in the docs site—edit the root `CHANGELOG.md` instead.

## Search

The site uses [Pagefind](https://pagefind.app/) for search. The search index is built automatically during `bun run build`.

Search indexes:
- All pages under `/docs/`
- The changelog page

## Deployment

The docs site is deployed to GitHub Pages automatically when changes are pushed to `main`. The deployment workflow is defined in `.github/workflows/docs.yml`.

### Manual Build

To verify the production build locally:

```bash
bun run build
bun run preview
```

The preview server will be available at `http://localhost:4321/ralph/`.

## Styling

The site uses Tailwind CSS with a custom dark-only theme. Key design tokens:

- **Ralph Blue (primary)**: `#22D3EE` — used for CTAs, links, and accents
- **Ralph Blue (hover)**: `#06B6D4`
- **Ralph Blue (subtle)**: `#0891B2`

All styles should use the semantic color tokens defined in `tailwind.config.mjs`.
