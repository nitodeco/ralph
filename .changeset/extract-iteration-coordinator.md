---
"ralph": patch
---

Extract IterationCoordinator service from orchestrator

- Created new iteration-coordinator service with types, implementation, and index files
- Moved iteration callback setup logic from orchestrator to IterationCoordinator
- Added IterationCoordinator to service container and bootstrap
- Updated orchestrator to delegate setupIterationCallbacks to IterationCoordinator
- Manages retry contexts and decomposition state through the service

