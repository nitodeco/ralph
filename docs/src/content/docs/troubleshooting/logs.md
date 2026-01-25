---
title: Where to Find Logs
description: Locate and interpret Ralph log files for debugging. Find session logs, iteration logs, and global logs with patterns for success, timeout, stuck, and error states.
sidebar:
  order: 2
  label: Logs
---

# Where to Find Logs

Ralph writes detailed logs that help diagnose issues. This page explains where to find them and how to interpret them.

## Log Locations

### Session Logs

Main log files are stored per-project:

```
~/.ralph/projects/<project>/logs/
```

Each session creates a timestamped log file:

```
~/.ralph/projects/<project>/logs/2024-01-15_103000.log
```

### Iteration Logs

Individual iteration logs contain agent output:

```
~/.ralph/projects/<project>/logs/iteration-5.log
```

### Global Log

A global log captures cross-project events:

```
~/.ralph/ralph.log
```

## Log Content

### Session Logs

Session logs include:

- Session start/stop times
- Configuration used
- Iteration summaries
- Errors and retries

Example:

```
[2024-01-15T10:30:00Z] Session started
[2024-01-15T10:30:01Z] Config: {"agent":"cursor","maxRetries":3}
[2024-01-15T10:30:02Z] Starting iteration 1
[2024-01-15T10:30:02Z] Task: Set up project scaffolding
[2024-01-15T10:35:00Z] Iteration 1 completed successfully
[2024-01-15T10:35:01Z] Starting iteration 2
```

### Iteration Logs

Iteration logs capture agent output:

```
[agent] Reading project structure...
[agent] Creating src/ directory
[agent] Writing package.json
[agent] Running bun install
[agent] Task complete
```

## Viewing Logs

### Recent Session Log

Find the most recent log:

```bash
ls -lt ~/.ralph/projects/<project>/logs/ | head -5
```

View it:

```bash
cat ~/.ralph/projects/<project>/logs/2024-01-15_103000.log
```

### Tail Logs in Real-Time

Watch logs as Ralph runs:

```bash
tail -f ~/.ralph/projects/<project>/logs/*.log
```

### Search Logs

Find specific errors:

```bash
grep -r "error" ~/.ralph/projects/<project>/logs/
```

## Interpreting Logs

### Success Pattern

```
[10:30:02] Starting iteration 1
[10:30:02] Task: Add user schema
[10:35:00] Agent called: ralph task done 1
[10:35:00] Iteration 1 completed successfully
```

### Timeout Pattern

```
[10:30:02] Starting iteration 1
[10:30:02] Task: Complex feature
[11:00:02] Timeout reached (1800000ms)
[11:00:02] Iteration 1 failed: timeout
[11:00:07] Retry 1/3 starting
```

### Stuck Pattern

```
[10:30:02] Starting iteration 1
[10:30:02] Task: Build project
[10:35:02] No output for 300000ms
[10:35:02] Agent appears stuck
[10:35:02] Iteration 1 failed: stuck
```

### Error Pattern

```
[10:30:02] Starting iteration 1
[10:30:02] Task: Run tests
[10:31:00] Agent exited with code 1
[10:31:00] Error: Tests failed
[10:31:00] Iteration 1 failed: error
```

## Debugging Tips

### Check Agent Output

Look for agent-specific issues in iteration logs. Common problems:

- Missing dependencies
- Syntax errors in generated code
- Failed commands

### Compare Successful vs Failed

Compare a successful iteration log with a failed one to spot differences.

### Enable Verbose Logging

For more detail, check if your agent supports verbose mode. Some agents accept flags for additional output.

## Log Retention

Ralph keeps logs indefinitely. To clean up old logs:

```bash
# Remove logs older than 7 days
find ~/.ralph/projects/<project>/logs/ -mtime +7 -delete
```

## Exporting Logs

For bug reports, collect relevant logs:

```bash
# Create a log bundle
tar -czf ralph-logs.tar.gz ~/.ralph/projects/<project>/logs/
```

Include this when reporting issues.

## Next Steps

- [Common Issues](/docs/troubleshooting/common-issues/) — Solutions to frequent problems
- [FAQ](/docs/faq/) — Frequently asked questions
