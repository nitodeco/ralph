---
"ralph": minor
---

Implement signal handling for graceful shutdown

- Added signal handlers for SIGTERM, SIGINT, and SIGHUP
- Save session state as 'stopped' on signal receipt for resumability
- Gracefully terminate running agent process via shutdown handler
- Clean up PID file on exit
- Log shutdown signal and completion to log file
- Integrated shutdown handler with agent store for proper agent termination

