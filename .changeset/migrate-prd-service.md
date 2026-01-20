---
"ralph": patch
---

Migrate PrdService to new service architecture

- Created src/lib/services/prd/ directory with self-contained service files
- Created types.ts with Prd, PrdTask, LoadPrdResult, DecompositionSubtask, DecompositionRequest, TaskWithIndex, CanWorkResult interfaces and PrdService interface
- Created validation.ts with isPrd, isPrdTask type guards
- Created implementation.ts with createPrdService factory function using closure-based caching
- Updated container.ts to import PrdService from ./prd/types.ts
- Updated bootstrap.ts to use createPrdService() instead of singleton
- Updated index.ts to re-export all PRD types, validation functions
- Updated src/lib/prd.ts facade to re-export from new service location
- Updated src/types/index.ts to export PRD types from services
- Removed Prd, PrdTask, LoadPrdResult, DecompositionSubtask, DecompositionRequest from src/types/prd.types.ts
- Removed isPrd, isPrdTask from src/lib/type-guards.ts
- Updated src/lib/integrity.ts to import isPrd from new location
- Updated InitWizard.tsx and AddTaskWizard.tsx to import isPrd/isPrdTask from services
- Deleted src/types/prd.types.ts
- Deleted src/lib/services/PrdService.ts (old singleton)
- All 414 tests pass

