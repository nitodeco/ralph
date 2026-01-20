---
"ralph": patch
---

Migrate ConfigService to new self-contained service architecture

- Created src/lib/services/config/ directory with types.ts, validation.ts, constants.ts, formatter.ts, and implementation.ts
- Moved RalphConfig, AgentType, NotificationConfig, MemoryConfig, VerificationConfig, ConfigValidationError, ConfigValidationResult to service types
- Moved isRalphConfig, isPartialRalphConfig, validateConfig to service validation
- Moved config constants and defaults to service constants
- Updated bootstrap to use createConfigService factory function
- Updated all re-exports through services/index.ts
- Deleted legacy ConfigService.ts, config/ directory, and constants/config.ts

