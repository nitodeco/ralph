---
"ralph": minor
---

Remove rules feature and merge into guardrails

The rules feature was identified as dead code during the architecture audit. Rules were never actually used in the prompt generation - only guardrails were. This change removes the entire rules subsystem:

- Removed RulesService and all related types
- Removed /rules and /rule CLI commands and slash commands  
- Removed RulesView component
- Removed rules from parser, paths, container, and bootstrap
- Updated help documentation to remove rules references

Users should use guardrails for all prompt instructions. Guardrails provide more features including triggers, categories, and enable/disable functionality.
