---
"ralph": patch
---

feat: convert path constants to registry-based functions

- Added new constants: REGISTRY_PATH, PROJECTS_DIR, LOCAL_RALPH_DIR
- Created new registry-based path functions: getSessionFilePath(), getPrdJsonPath(), getProgressFilePath(), getInstructionsFilePath(), getProjectConfigPath(), getGuardrailsFilePath(), getFailureHistoryFilePath(), getSessionMemoryFilePath(), getLogsDir(), getArchiveDir()
- Added ensureProjectDirExists() for creating project directories in global storage
- Kept deprecated constants (RALPH_DIR, LOGS_DIR, etc.) for backward compatibility during migration
- Updated ensureLogsDirExists() to use getLogsDir()
