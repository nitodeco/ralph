---
"ralph": patch
---

Add failsafes and error handling to agent loop

- Add try-catch around stream reading operations to prevent crashes from stream read failures
- Add safe decoder handling for invalid UTF-8 data with graceful fallback
- Add timeout protection (30s) for process exit to prevent infinite hangs
- Add error isolation for event handlers in orchestrator to prevent cascading failures
- Add process state validation in AgentProcessManager to detect desynchronization
- Add error handling for output handler callbacks to prevent callback errors from crashing stream reading
- Add new error codes: AGENT_STREAM_ERROR, AGENT_PROCESS_HANG, AGENT_DECODE_ERROR
- Wrap retry context generation in try-catch with fallback to retry without context
- Wrap verification handler, learning handler, and iteration log operations in try-catch
