---
"ralph": patch
---

Refactor orchestrator to composition root pattern

- Converted orchestrator from singleton class to service following existing service patterns
- Created orchestrator service in src/lib/services/orchestrator/ with types, implementation, and index
- Added orchestrator to service container and bootstrap
- Updated all imports to use getOrchestrator() from services
- Removed old stores/orchestrator.ts file
- Updated tests to use the new service pattern with proper callbacks

