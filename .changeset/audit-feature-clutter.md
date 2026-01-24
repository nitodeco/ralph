---
"ralph": patch
---

Audit and consolidate feature clutter

- Removed redundant `stats` command (use `usage` instead for comprehensive statistics)
- Added usage subcommands documentation to help text
- Updated tests to reflect command changes

Audit findings documented:
- Parallel execution: KEEP - well-implemented with proper dependency graph support
- Technical debt handler: KEEP - has consumer in IterationCoordinator
- Session memory: KEEP - properly utilized in prompts
- Views (Analyze, Archive, Memory, Plan): KEEP - all functional and needed
- Rules vs Guardrails: Future task - rules are not used in prompts (dead code)
