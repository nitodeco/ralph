---
title: Installation
description: Install Ralph on macOS, Linux, or Windows (WSL) using the automated install script, manual binary download, or building from source with Bun.
sidebar:
  order: 2
  label: Installation
---

# Installation

Ralph can be installed using the automated install script or manually from source. This guide covers both methods and helps you verify your installation.

## Prerequisites

Before installing Ralph, ensure you have:

### Required

- **One of these AI agents:**
  - [Cursor CLI](https://docs.cursor.com/cli) (most common)
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
  - [Codex CLI](https://github.com/openai/codex)
- **Git** — For version control and GitHub features

### Optional (for building from source)

- **Bun** or **Node.js 18+** — Only needed if building from source

## Quick Install (Recommended)

The fastest way to install Ralph is using the automated install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

### What the Script Does

1. Detects your operating system and CPU architecture
2. Downloads the latest release binary for your platform
3. Installs it to `~/.local/bin` (or `/usr/local/bin` if you have permissions)
4. Adds the installation directory to your PATH if needed
5. Verifies the installation

### Supported Platforms

- macOS (Intel and Apple Silicon)
- Linux (x64 and ARM64)
- Windows via WSL

## Manual Installation

### Option 1: Download Binary

Download the appropriate binary for your platform from the [releases page](https://github.com/nitodeco/ralph/releases/latest):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-macos-arm64 -o ralph

# macOS (Intel)
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-macos-x64 -o ralph

# Linux (x64)
curl -L https://github.com/nitodeco/ralph/releases/latest/download/ralph-linux-x64 -o ralph

# Make it executable
chmod +x ralph

# Move to a directory in your PATH
mv ralph ~/.local/bin/ralph
```

### Option 2: Build from Source

Clone the repository and build:

```bash
git clone https://github.com/nitodeco/ralph.git
cd ralph
bun install
bun run build
```

The build creates platform-specific binaries in the `dist/` directory.

Link it globally:

```bash
bun link
```

Or manually copy the binary:

```bash
cp dist/ralph-* ~/.local/bin/ralph
```

## Verify Installation

After installation, verify Ralph is working correctly:

```bash
ralph --version
```

Expected output:

```
ralph version 0.14.5
```

### Verify AI Agent

Ensure your chosen AI agent is installed and accessible:

```bash
# For Cursor CLI
which cursor

# For Claude Code
which claude

# For Codex
which codex
```

Each command should return a path. If not, install the appropriate agent:

- [Cursor CLI installation guide](https://docs.cursor.com/cli)
- [Claude Code installation guide](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI installation guide](https://github.com/openai/codex)

### Verify Git

```bash
git --version
```

Should output Git version 2.x or higher.

## Troubleshooting Installation

### "ralph: command not found"

The installation directory isn't in your PATH. Add it manually:

```bash
# For bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# For zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "Permission denied" When Running Install Script

The script needs write access to the installation directory. Either:

1. Run with sudo (installs to `/usr/local/bin`):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | sudo bash
   ```

2. Or ensure `~/.local/bin` exists and is writable:
   ```bash
   mkdir -p ~/.local/bin
   ```

### Build Fails with "bun: command not found"

Install Bun first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Or use npm/yarn if you have Node.js:

```bash
npm install
npm run build
```

## Updating Ralph

To update to the latest version:

```bash
ralph update
```

This checks for updates and installs the newest release automatically.

Or manually re-run the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

## Uninstalling Ralph

Remove the Ralph binary:

```bash
rm ~/.local/bin/ralph
# or
rm /usr/local/bin/ralph
```

Optionally remove Ralph's data directory:

```bash
rm -rf ~/.ralph
```

This deletes all projects, configurations, and session data.

## Next Steps

- [Quickstart](/docs/getting-started/quickstart/) — Create your first PRD and run a session
- [Configuration](/docs/configuration/overview/) — Configure Ralph for your workflow
- [GitHub Integration](/docs/github-integration/setup/) — Set up GitHub authentication
