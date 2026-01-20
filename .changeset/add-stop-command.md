---
"ralph": minor
---

Add 'ralph stop' command for gracefully shutting down running Ralph processes

- Sends SIGTERM for graceful shutdown with configurable timeout
- Falls back to SIGKILL if process doesn't exit within timeout
- Updates session status to 'stopped' for potential resume
- Handles edge cases like stale PID files and already-stopped processes

