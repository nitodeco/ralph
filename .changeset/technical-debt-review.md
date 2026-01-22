---
"ralph": minor
---

feat: add post-run technical debt review

Implemented automatic technical debt review at session completion:

- Created TechnicalDebtHandler that analyzes iteration logs for quality issues
- Detects retry patterns, verification failures, decomposition frequency, error patterns, and performance issues
- Generates structured reports with severity levels (critical/high/medium/low)
- Provides actionable recommendations based on detected issues
- Added TechnicalDebtReviewConfig to RalphConfig for customization
- Integrated into orchestrator's onAllComplete callback
- Added session:technical_debt_review event for external integrations
- Report is automatically appended to progress file when issues are found

