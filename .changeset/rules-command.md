---
"ralph": minor
---

Add /rules command for managing custom instructions

This adds a new command for managing custom rules (instructions) that are injected into the agent prompt. Rules are simpler than guardrails - they are just text instructions without triggers or categories.

Features:
- CLI: `ralph rules [list|add|remove]`
- Slash commands: `/rules` (view), `/rule <text>` (add)
- Terminal UI: Interactive RulesView with add/delete/navigate
- Stored per-project in `rules.json`
