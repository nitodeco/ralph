---
"ralph": minor
---

Add multi-process support to AgentProcessManager for parallel task execution

- Changed from single-process to Map-based multi-process tracking
- Added process identifier support for managing multiple concurrent agent processes
- New methods: registerProcess, unregisterProcess, getProcessById, getAllProcessIds, getAllProcessInfo, getActiveProcessCount, isAnyRunning, killAll, resetAll, clearAllForceKillTimeouts
- Maintained backward compatibility with existing single-process API by using a default process identifier
- Added per-process state tracking: aborted, retryCount, forceKillTimeout, createdAt
- Added global abort state that affects all processes
- Exported ProcessEntry and ProcessInfo types for external use
