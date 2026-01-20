---
"ralph": patch
---

Refactor: Split config.ts into focused modules

- Created src/lib/config/ directory with focused submodules:
  - constants.ts: CONFIG_DEFAULTS, AGENT_COMMANDS, VALID_AGENTS, etc.
  - loader.ts: loadConfig, saveConfig, loadGlobalConfig, etc.
  - validator.ts: validateConfig and all validation helpers
  - formatter.ts: formatValidationErrors, getConfigSummary, formatMs, formatBytes
  - index.ts: re-exports everything for backward compatibility
- Updated src/lib/config.ts to re-export from config/index.ts
- All existing imports from @/lib/config continue to work unchanged

