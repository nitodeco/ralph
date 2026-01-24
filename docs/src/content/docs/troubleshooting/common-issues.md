---
title: Common Issues
description: Solutions to common problems when using Ralph.
sidebar:
  order: 1
  label: Common Issues
---

# Common Issues

This page covers frequently encountered issues and their solutions.

## Agent Issues

### "Agent not found"

**Error:** `cursor: command not found` (or similar)

**Solution:** Ensure your AI agent is installed and in your PATH:

```bash
# Verify Cursor CLI is available
which cursor

# Or for Claude Code
which claude

# Or for Codex
which codex
```

If not found, install the appropriate CLI:

- [Cursor CLI installation](https://docs.cursor.com/cli)
- [Claude Code installation](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI installation](https://github.com/openai/codex)

### Agent Keeps Timing Out

**Problem:** Iterations consistently hit the timeout limit.

**Solutions:**

1. Increase the timeout:

```json
{
  "agentTimeoutMs": 3600000
}
```

2. Break tasks into smaller pieces
3. Check if the agent is stuck on a complex operation

### Agent Appears Stuck

**Problem:** Agent runs but produces no output.

**Solutions:**

1. Reduce stuck threshold to trigger faster retries:

```json
{
  "stuckThresholdMs": 180000
}
```

2. Check system resources (CPU, memory)
3. Try a different agent

## Session Issues

### "Session already running"

**Error:** A session is already active for this project.

**Solution:**

```bash
# Stop the existing session
ralph stop

# Or check status first
ralph status
```

### Can't Resume Session

**Problem:** `ralph resume` says no session to resume.

**Solutions:**

1. Check session state:

```bash
ralph status
```

2. If corrupted, clear and start fresh:

```bash
ralph clear
ralph run
```

### Session Progress Lost

**Problem:** Progress notes or task status disappeared.

**Causes:**

- Session was cleared
- Working in wrong directory
- Project not registered

**Solution:** Check you're in the right project:

```bash
ralph projects current
```

## Task Issues

### "No tasks found"

**Error:** No tasks defined in PRD.

**Solution:** Initialize or verify your PRD:

```bash
ralph init
# or
ralph task list
```

### Tasks Not Completing

**Problem:** Agent marks task done but status doesn't update.

**Solutions:**

1. Verify the agent is calling ralph commands:
   - Check logs for `ralph task done` calls
2. Ensure ralph is accessible from agent environment

### Wrong Task Being Worked On

**Problem:** Agent working on unexpected task.

**Solution:** Check current task:

```bash
ralph task current
```

If incorrect, use `ralph task done/undone` to fix status.

## GitHub Issues

### "Not authenticated"

**Error:** GitHub operations fail with auth error.

**Solution:**

```bash
ralph auth login
```

### "Repository not found"

**Error:** Can't detect GitHub repository.

**Solutions:**

1. Verify git remote:

```bash
git remote -v
```

2. Ensure remote points to GitHub
3. Check you're in the project directory

### PR Creation Fails

**Problem:** Can't create pull request.

**Solutions:**

1. Re-authenticate:

```bash
ralph auth logout
ralph auth login
```

2. Verify permissions include `repo` scope
3. Check branch doesn't already exist

## Configuration Issues

### "Invalid configuration"

**Error:** Config file is malformed.

**Solution:** Check JSON syntax:

```bash
ralph config
```

This validates and shows effective configuration. Fix any reported issues in `~/.ralph/config.json` or the project config.

### Settings Not Taking Effect

**Problem:** Changed config but behavior unchanged.

**Causes:**

- Editing wrong config file
- Syntax error in JSON
- Session running with old config

**Solutions:**

1. Stop and restart session after config changes
2. Verify with `ralph config` that settings are loaded

## Memory Issues

### "Memory warning"

**Warning:** Process memory exceeds threshold.

**Solutions:**

1. Reduce output buffer:

```json
{
  "memory": {
    "maxOutputBufferBytes": 2621440
  }
}
```

2. Clear session and restart:

```bash
ralph clear
```

## Getting Help

If your issue isn't listed here:

1. Check [Where to Find Logs](/ralph/docs/troubleshooting/logs/)
2. Search [GitHub Issues](https://github.com/nitodeco/ralph/issues)
3. Open a new issue with:
   - Ralph version (`ralph --version`)
   - Agent being used
   - Error message or unexpected behavior
   - Steps to reproduce

## Next Steps

- [Where to Find Logs](/ralph/docs/troubleshooting/logs/) — Debug with log files
- [FAQ](/ralph/docs/faq/) — Frequently asked questions
