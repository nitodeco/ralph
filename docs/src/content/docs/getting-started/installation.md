---
title: Installation
description: How to install Ralph on your system using the install script or manual installation.
sidebar:
  order: 2
  label: Installation
---

# Installation

Ralph can be installed using the automated install script or manually from source.

## Quick Install (Recommended)

The fastest way to install Ralph is using the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

This script will:

1. Detect your operating system and architecture
2. Download the latest release binary
3. Install it to `~/.local/bin` (or another appropriate location)
4. Add it to your PATH if needed

## Prerequisites

Ralph requires:

- **Cursor CLI**: Ralph orchestrates Cursor CLI for AI agent runs
- **Git**: For repository operations and GitHub integration
- **Node.js 18+** or **Bun**: If installing from source

## Manual Installation

### From npm

```bash
npm install -g @nitodeco/ralph
```

### From Source

Clone the repository and build:

```bash
git clone https://github.com/nitodeco/ralph.git
cd ralph
bun install
bun run build
```

Then link it globally:

```bash
bun link
```

## Verify Installation

After installation, verify Ralph is working:

```bash
ralph --version
```

## Next Steps

- [Quickstart](/ralph/docs/getting-started/quickstart/) - Get up and running with your first PRD
- [Configuration](/ralph/docs/configuration/overview/) - Configure Ralph for your workflow
