---
"ralph": patch
---

Consolidate session lifecycle management in orchestrator

- Moved session creation logic from appStore.startIterations() to orchestrator.startSession()
- Moved session resume logic from appStore.resumeSession() to orchestrator.resumeSession()
- Moved fatal error handling from appStore.handleFatalError() to orchestrator.handleFatalError()
- Simplified appStore methods to only manage UI state and delegate session lifecycle to orchestrator
- Added StartSessionResult and ResumeSessionResult types to orchestrator for better type safety
- Orchestrator now emits session events (session:start, session:resume, session:stop) centrally
