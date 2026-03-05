---
"ralph": patch
---

Fix resource cleanup for spawned processes by clearing pending abort kill timers in `runAgentWithPrompt` and closing daemon log file descriptors after process spawn to prevent descriptor leaks.
