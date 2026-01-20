---
"ralph": patch
---

Consolidate type exports to single canonical path (@/types)

- Remove type re-exports from src/lib/config.ts (ConfigValidationError, ConfigValidationResult)
- Remove type re-exports from src/lib/prd.ts (LoadPrdResult)
- Remove type re-exports from src/stores/appStore.ts (ActiveView, AppState, SetManualTaskResult, ValidationWarning)
- Update src/stores/index.ts to re-export types from @/types instead of appStore
