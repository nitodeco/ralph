---
"ralph": minor
---

Integrate PR creation into branch mode flow

When branch mode is enabled and `autoCreatePr` is configured in gitProvider settings:
- Automatically creates a pull request after pushing task branches
- Supports draft PRs via `prDraft` config option
- Supports adding labels via `prLabels` config option
- Supports adding reviewers via `prReviewers` config option
- Emits `session:pr_created` and `session:pr_failed` events for tracking
- Adds PR URL to progress notes when successful
