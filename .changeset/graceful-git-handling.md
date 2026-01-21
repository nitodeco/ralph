---
"ralph": patch
---

Gracefully handle non-git repositories

- Add isGitRepository() utility function in src/lib/paths.ts
- Track git repository status in appStore.ts during project validation
- Conditionally include commit instructions in agent prompts based on git availability
- Warn users during dry-run validation when not in a git repository
- Add tests for the new isGitRepository() function
