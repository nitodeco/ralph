---
"ralph": minor
---

Add adaptive retry with failure context injection

- Create failure-analyzer.ts with pattern detection for build failures, test failures, lint errors, permission errors, timeouts, stuck processes, network errors, syntax errors, and dependency errors
- Implement generateRetryContext() to format contextual guidance for retry attempts
- Update agentStore to analyze failures and inject context into subsequent retry prompts
- Add IterationLogRetryContext type to track retry history in iteration logs
- Add retryWithContext config option (default: true) to enable/disable adaptive retry
- Log retry analysis to progress.txt for debugging
