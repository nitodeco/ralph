---
"ralph": patch
---

Extract BranchModeManager from orchestrator

Refactored branch mode functionality into a dedicated service:
- Created branch-mode-manager service with types, implementation, and index files
- Added BranchModeManager to ServiceContainer and bootstrap
- Updated orchestrator to delegate all branch mode methods to the new service
- Added mock implementation for test services
