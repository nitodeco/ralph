---
"ralph": patch
---

Update documentation to reflect refactored architecture

- Updated CLAUDE.md with new orchestrator service composition (SessionManager, IterationCoordinator, HandlerCoordinator, ParallelExecutionManager, BranchModeManager)
- Updated CLAUDE.md to reflect minimal event bus (only agent:complete and agent:error events)
- Added analyze debt command to CLI reference documentation
- Updated local development docs with detailed service creation pattern
- Updated project storage structure documentation
