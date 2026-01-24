---
"ralph": patch
---

Remove config/PRD wrapper indirection by migrating all imports from `@/lib/config.ts` and `@/lib/prd.ts` to use service layer directly via `@/lib/services/index.ts`. This simplifies the codebase by eliminating unnecessary wrapper modules.
