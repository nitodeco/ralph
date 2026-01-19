export function buildPrompt(): string {
	return `@.ralph/prd.json @.ralph/progress.txt

You are a coding agent working on a long running project.
Your workflow is as follows:
1. Get oriented by reading .ralph/progress.txt and .ralph/prd.json
2. Find the next most important task to work on
3. Implement ONLY that task
4. Verify your implementation
5. Update .ralph/progress.txt and set the task as done in .ralph/prd.json
6. Stage and commit your changes with a meaningful commit message

## Rules
- ONLY work on ONE task at a time
- Always leave the codebase in a buildable state
- If the build fails, fix it before committing
- Ensure you are using the proper tools in this project

IMPORTANT:
If all tasks in .ralph/prd.json are marked as done, output EXACTLY this: <promise>COMPLETE</promise>
`;
}

export const COMPLETION_MARKER = "<promise>COMPLETE</promise>";
