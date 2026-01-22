---
"ralph": patch
---

Add Git Branch Mode Support

Introduces a new workflow mode that creates feature branches for each task, allowing features to be implemented in isolation. When enabled, Ralph will:

- Create a new branch for each task (e.g., `ralph/task-1-add-feature`)
- Push the branch to remote after task completion
- Return to the base branch to begin the next task

Configuration options:
- `workflowMode: "branches"` - Enable branch mode
- `branchMode.enabled` - Alternative way to enable branch mode
- `branchMode.branchPrefix` - Customize branch prefix (default: "ralph")
- `branchMode.pushAfterCommit` - Whether to push after task completion (default: true)
- `branchMode.returnToBaseBranch` - Whether to return to base branch (default: true)

New GitBranchService provides utilities for:
- Creating and checking out branches
- Getting current branch and working directory status
- Pushing branches and returning to base branch
- Stashing and popping changes
