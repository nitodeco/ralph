---
"ralph": patch
---

Add regression tests for refactored orchestrator services

Added comprehensive test suites for the refactored orchestrator composition:
- session-manager.test.ts: Tests for session lifecycle management (start, resume, fatal error handling, usage statistics recording)
- iteration-coordinator.test.ts: Tests for iteration callbacks, retry context management, decomposition state
- handler-coordinator.test.ts: Tests for event subscriptions, agent completion/error handling, verification state
- branch-mode-manager.test.ts: Tests for branch mode lifecycle (enable/disable, task branch creation, PR workflow)
- orchestrator.test.ts: Tests for the composition root delegating to all sub-services

