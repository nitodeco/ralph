---
title: Introduction
description: Get started with Ralph, a CLI tool for long-running PRD-driven development with AI coding agents.
sidebar:
  order: 1
  label: Introduction
---

# Introduction

Ralph is a CLI tool for long-running PRD-driven development with AI coding agents. It orchestrates iterative agent runs to work through tasks defined in a PRD, with retries, verification, progress tracking, and GitHub integration.

## What is Ralph?

Ralph sits between you and your AI coding agent (like Cursor CLI), managing long-running development sessions. Instead of manually prompting and re-prompting your agent, Ralph:

- Reads your PRD to understand what needs to be built
- Breaks down tasks and feeds them to the agent one at a time
- Monitors progress and retries when things go wrong
- Tracks what's been completed across sessions
- Creates GitHub PRs when you're ready

## Why Ralph?

AI coding agents are powerful but require constant supervision. Ralph automates the supervision loop so you can step away while complex tasks get completed.

**Key benefits:**

- **PRD-driven**: Define your requirements once, let Ralph execute them
- **Long-running sessions**: Work continues even when you're not watching
- **Automatic retries**: Failed iterations get retried with context about what went wrong
- **Progress tracking**: Pick up where you left off, even across multiple sessions
- **GitHub integration**: Automatically create PRs from completed work

## Quick Start

Install Ralph using the install script:

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

Then initialize Ralph in your project:

```bash
ralph init
```

## Next Steps

- [Installation](/ralph/docs/getting-started/installation/) - Detailed installation instructions
- [Quickstart](/ralph/docs/getting-started/quickstart/) - Get up and running quickly
- [Core Concepts](/ralph/docs/core-concepts/prds/) - Understand how Ralph works
