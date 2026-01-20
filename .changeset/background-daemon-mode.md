---
"ralph": minor
---

Add background/daemon mode for unattended overnight runs

- Add --background or -b flag to run Ralph detached from the terminal
- Write PID to .ralph/ralph.pid for process tracking
- Redirect stdout/stderr to log file in background mode
- Automatically start iterations when running as a daemon
- Clean up PID file on process exit or termination signals
