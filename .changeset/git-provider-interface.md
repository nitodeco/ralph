---
"ralph": minor
---

Add Internal Git Provider Interface

Introduces a modular git provider system that enables pull request operations across different hosting platforms. This is a foundational change for automatic PR creation in branch mode.

New GitProviderService provides:
- Provider detection from git remote URLs (GitHub, GitLab, Bitbucket)
- A registry system for provider implementations
- Type-safe interfaces for PR operations (create, get, update, close)

Configuration options:
- `gitProvider.github` - GitHub provider settings (token, apiUrl)
- `gitProvider.gitlab` - GitLab provider settings (token, apiUrl)
- `gitProvider.bitbucket` - Bitbucket provider settings (token, apiUrl)
- `gitProvider.autoCreatePr` - Whether to auto-create PRs (default: false)
- `gitProvider.prDraft` - Create PRs as drafts (default: true)
- `gitProvider.prLabels` - Labels to add to PRs
- `gitProvider.prReviewers` - Reviewers to request on PRs

Types exported:
- `GitProvider` - Interface for provider implementations
- `GitProviderService` - Main service interface
- `PullRequest`, `PullRequestCreateOptions`, `PullRequestUpdateOptions`
- `RemoteInfo`, `GitProviderType`, `ProviderOperationResult`
