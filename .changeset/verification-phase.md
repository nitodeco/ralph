---
"ralph": minor
---

Add verification phase after each iteration

- Added VerificationConfig interface with buildCommand, testCommand, lintCommand, customChecks, and failOnWarning options
- Created src/lib/verification.ts with runVerification() and runCheck() functions
- Orchestrator now runs verification after agent completes (before marking iteration as done)
- If verification fails, iteration status is set to 'verification_failed' and triggers retry
- Added verification results to iteration logs (IterationLogVerification)
- Added --skip-verification CLI flag to bypass verification checks
- Added verification status display in IterationProgress component
- Verification results are logged to progress.txt
