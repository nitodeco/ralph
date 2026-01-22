---
"ralph": minor
---

Add first-run user consent warning

Displays a safety warning on initial startup informing users that Ralph uses flags like `--dangerously-skip-permissions`, `--force`, and `--full-auto` to enable autonomous AI agent execution.

- Users must acknowledge the warning by selecting "I understand the risks" and typing "I understand" to proceed
- The acknowledgment is persisted to global config (`hasAcknowledgedWarning` flag)
- The warning is only shown once; subsequent runs skip the consent screen
- Only affects the `run` and `resume` commands; CLI commands like `help`, `status`, etc. work without consent
