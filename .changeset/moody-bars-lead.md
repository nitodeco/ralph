---
"ralph": patch
---

Fix subprocess lifecycle handling in `AgentProcessManager` so abort state survives process teardown and force-kill escalation runs reliably when child processes do not exit after `SIGTERM`.
