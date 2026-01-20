---
"ralph": patch
---

Migrate GuardrailsService to new architecture

- Created src/lib/services/guardrails/ directory with self-contained service files
- Created types.ts with PromptGuardrail, GuardrailTrigger, GuardrailCategory, AddGuardrailOptions, GuardrailsFile interfaces and GuardrailsService interface
- Created validation.ts with isPromptGuardrail, isGuardrailsFile type guards
- Created defaults.ts with createDefaultGuardrails function
- Created formatters.ts with formatGuardrailsForPrompt function
- Created implementation.ts with createGuardrailsService factory function using closure-based caching
- Updated container.ts to add GuardrailsService to ServiceContainer and getGuardrailsService() accessor
- Updated bootstrap.ts to create GuardrailsService instance and add mock for tests
- Updated index.ts to re-export all guardrails types, constants, formatters, and validation functions
- Updated all consumers (prompt.ts, guardrails.ts CLI command, useSlashCommands.ts, GuardrailsView.tsx, AnalyzeView.tsx)
- Updated test files to use bootstrapTestServices() with real GuardrailsService
- Removed PromptGuardrail, GuardrailTrigger, GuardrailCategory from src/types/config.types.ts
- Removed isGuardrailsFile from src/lib/type-guards.ts
- Re-exported guardrails types from src/types/index.ts via services
- Updated src/lib/constants/defaults.ts to re-export createDefaultGuardrails from service
- Deleted src/lib/guardrails.ts
- All 414 tests pass
