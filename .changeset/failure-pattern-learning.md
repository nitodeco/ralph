---
"ralph": minor
---

Add failure pattern learning and analysis system

- Track failure patterns across iterations and sessions to identify recurring issues
- Store failure history in .ralph/failure-history.json with rolling window (last 100 failures)
- Implement pattern detection using regex matching and string similarity for common failure types
- Add 'ralph analyze' CLI command that displays: top failure patterns, suggested guardrails, tasks with highest failure rates, and recommendations
- Add 'ralph analyze export' to export analysis as JSON for external processing
- Add 'ralph analyze clear' to clear failure history
- Add '/analyze' slash command in the terminal UI to view failure pattern analysis
- Add AnalyzeView component for interactive pattern viewing and guardrail suggestions
- Automatically record failures and analyze patterns after each failed iteration when learningEnabled is true
- When a pattern reaches threshold (3 occurrences), automatically suggest adding a guardrail
- Add learningEnabled config option (boolean, default true) to enable/disable pattern learning
