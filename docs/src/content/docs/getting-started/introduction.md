---
title: Introduction
description: Get started with Ralph, the CLI tool that orchestrates AI coding agents like Cursor, Claude Code, and Codex for autonomous PRD-driven development with retries and progress tracking.
sidebar:
  order: 1
  label: Introduction
---

# Introduction

Ralph is a CLI tool that orchestrates AI coding agents to work through Product Requirements Documents (PRDs) autonomously. It manages long-running development sessions with automatic retries, progress tracking, and GitHub integration.

## What is Ralph?

Ralph acts as an orchestration layer between you and AI coding agents like Cursor CLI, Claude Code, or Codex. Instead of manually prompting your agent repeatedly, Ralph automates the entire development workflow.

### How It Works

1. **Define your requirements** — Create a PRD with tasks describing what you want to build
2. **Start a session** — Ralph feeds tasks to your AI agent one at a time
3. **Automatic execution** — The agent implements each task while Ralph monitors progress
4. **Retry on failure** — When things go wrong, Ralph automatically retries with context
5. **Track progress** — All work is tracked across sessions so you can resume anytime
6. **Ship your work** — Create GitHub PRs directly from completed sessions

### Real-World Example

Instead of this manual workflow:

```bash
# You manually prompt the agent
cursor "Implement user authentication"
# Wait and watch...
# Agent gets stuck, you intervene
cursor "Fix the authentication bug"
# Repeat dozens of times...
```

Ralph automates it:

```bash
ralph init  # Define what you want to build
ralph run   # Let Ralph orchestrate everything
```

Ralph handles the iteration loop, retries, progress tracking, and task sequencing automatically.

## Why Use Ralph?

AI coding agents are powerful but require constant supervision. They can get stuck, lose context, or fail partway through complex tasks. Ralph solves these problems:

### Key Benefits

**PRD-Driven Development**
Define your requirements once in a structured format. Ralph ensures every task gets completed before moving on.

**Autonomous Execution**
Start a session and step away. Ralph monitors the agent, handles failures, and continues working through your task list.

**Intelligent Retries**
When an iteration fails, Ralph doesn't just try again blindly. It provides context about what went wrong, helping the agent succeed on retry.

**Session Persistence**
Stop and resume sessions anytime. Ralph maintains state across runs, so you never lose progress.

**GitHub Integration**
Authenticate once and Ralph can create pull requests, manage branches, and push commits automatically.

**Multi-Project Support**
Work on multiple projects simultaneously. Each project maintains its own PRD, configuration, and session state.

## When to Use Ralph

Ralph is ideal for:

- Building features that require multiple steps
- Long-running development tasks that take hours or days
- Projects where you want to step away and let AI work autonomously
- Teams that want consistent, trackable AI-assisted development

Ralph may not be necessary for:

- Single-file changes or quick fixes
- Exploratory coding where requirements aren't clear
- Tasks that require frequent human decision-making

## Quick Start

Get up and running in under 5 minutes:

### Install Ralph

```bash
curl -fsSL https://raw.githubusercontent.com/nitodeco/ralph/main/scripts/install.sh | bash
```

### Initialize Your First Project

```bash
cd your-project
ralph init
```

Ralph will guide you through creating your first PRD.

### Start Building

```bash
ralph run
```

Watch as Ralph orchestrates your AI agent to complete tasks from your PRD.

## What You'll Learn

This documentation covers:

- **Getting Started** — Installation, setup, and your first session
- **Core Concepts** — How PRDs, tasks, sessions, and iterations work
- **CLI Reference** — Complete command documentation
- **Configuration** — Customize Ralph for your workflow
- **GitHub Integration** — Set up authentication and PR creation
- **Troubleshooting** — Solutions to common issues

## Next Steps

- [Installation](/docs/getting-started/installation/) — Install Ralph and verify your setup
- [Quickstart](/docs/getting-started/quickstart/) — Complete your first development session
- [Core Concepts](/docs/core-concepts/prds/) — Understand how Ralph works under the hood
