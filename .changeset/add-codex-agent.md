---
"ralph": minor
---

Add Codex agent support

- Added 'codex' to the AgentType union type
- Added Codex to VALID_AGENTS array
- Added Codex CLI command configuration: ['codex', '-q', '--approval-mode', 'full-auto']
- Added Codex option to SetupWizard agent selection
- Updated IterationLogAgent type to use AgentType instead of hardcoded union

