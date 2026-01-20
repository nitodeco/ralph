---
"ralph": minor
---

Add dynamic prompt guardrail system for tuning agent behavior

- Added PromptGuardrail interface with id, instruction, trigger, category, enabled, and addedAt fields
- Created src/lib/guardrails.ts with loadGuardrails, saveGuardrails, addGuardrail, removeGuardrail, toggleGuardrail, and getActiveGuardrails functions
- Added GUARDRAILS_FILE_PATH constant to src/lib/paths.ts
- Added DEFAULT_GUARDRAILS with essential guardrails: verify before commit, read existing patterns, fix build before proceeding
- Updated buildPrompt() to inject active guardrails into the prompt under a "## Guardrails" section
- Added 'ralph guardrails' CLI command with list, add, remove, and toggle subcommands
- Added '/guardrail <instruction>' slash command for quick guardrail addition during sessions
- Added '/guardrails' slash command to open the guardrails management view
- Created GuardrailsView component for interactive guardrail management in the terminal UI
