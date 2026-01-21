---
"ralph": patch
---

Add memory leak prevention for long-running sessions

- Fix timeout leak in AgentProcessManager.safeKillProcess by tracking and clearing pending kill timeouts
- Add clearCallbacks and reset methods to iterationStore to prevent closure accumulation
- Add reset method to createThrottledFunction utility for proper timeout cleanup
- Clear iteration callbacks in orchestrator cleanup to prevent closure leaks between sessions
- Add getListenerCount and getListenerStats methods to eventBus for memory debugging
- Add performSessionCleanup function for comprehensive session resource cleanup
- Add getMemoryDiagnostics function for debugging memory and resource state
