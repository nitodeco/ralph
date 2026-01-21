---
"ralph": patch
---

Update components and stores to use new registry-based path functions

- Updated InitWizard.tsx to use getProgressFilePath(), getPrdJsonPath(), and ensureProjectDirExists() instead of deprecated constants
- Updated appStore.ts to remove LOCAL_RALPH_DIR import and use a more generic error message
- All 507 tests pass

