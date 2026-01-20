---
"ralph": minor
---

Add agent timeout and watchdog functionality

- Add configurable agent timeout (default 30 minutes) to kill long-running agent processes
- Add stuck detection based on stdout/stderr activity with configurable threshold (default 5 minutes)
- Agent is killed and retried if timeout or stuck threshold is exceeded
- Both features can be disabled by setting threshold to 0
- Add SetupWizard steps for configuring timeout and stuck detection settings

