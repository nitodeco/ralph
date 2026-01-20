import type { Prd, PrdFormat } from "@/types.ts";

export interface BuildPromptOptions {
	instructions?: string | null;
}

export function buildPrompt(options: BuildPromptOptions = {}): string {
	const { instructions } = options;

	const instructionsSection = instructions ? `\n## Project Instructions\n${instructions}\n` : "";

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
${instructionsSection}
IMPORTANT:
If all tasks in .ralph/prd.json are marked as done, output EXACTLY this: <promise>COMPLETE</promise>
`;
}

export const COMPLETION_MARKER = "<promise>COMPLETE</promise>";
export const PRD_OUTPUT_START = "<prd_output>";
export const PRD_OUTPUT_END = "</prd_output>";
export const TASK_OUTPUT_START = "<task_output>";
export const TASK_OUTPUT_END = "</task_output>";

export function buildPrdGenerationPrompt(description: string, format: PrdFormat): string {
	const formatExample =
		format === "yaml"
			? `project: "Project Name"
tasks:
  - title: "Task 1 Title"
    description: "Detailed description of what this task accomplishes"
    steps:
      - "Step 1"
      - "Step 2"
    done: false`
			: `{
  "project": "Project Name",
  "tasks": [
    {
      "title": "Task 1 Title",
      "description": "Detailed description of what this task accomplishes",
      "steps": ["Step 1", "Step 2"],
      "done": false
    }
  ]
}`;

	return `You are a project planning assistant. Based on the user's description, generate a complete PRD (Product Requirements Document) in ${format.toUpperCase()} format.

## User's Project Description:
${description}

## Instructions:
1. Analyze the description and break it down into logical, actionable tasks
2. Each task should be small enough to complete in one coding session
3. Order tasks by dependency (tasks that others depend on should come first)
4. Write clear, specific descriptions and steps for each task
5. Generate a meaningful project name based on the description

## Output Format:
Output ONLY the ${format.toUpperCase()} content wrapped in markers. Do not include any other text.

${PRD_OUTPUT_START}
${formatExample}
${PRD_OUTPUT_END}

Generate the PRD now:`;
}

export function buildAddTaskPrompt(
	description: string,
	existingPrd: Prd,
	format: PrdFormat,
): string {
	const formatExample =
		format === "yaml"
			? `title: "Task Title"
description: "Detailed description of what this task accomplishes"
steps:
  - "Step 1"
  - "Step 2"
done: false`
			: `{
  "title": "Task Title",
  "description": "Detailed description of what this task accomplishes",
  "steps": ["Step 1", "Step 2"],
  "done": false
}`;

	const existingTasksList = existingPrd.tasks
		.map((task, index) => `${index + 1}. ${task.title}${task.done ? " (done)" : ""}`)
		.join("\n");

	return `You are a project planning assistant. Based on the user's description, generate a single new task to add to an existing PRD.

## Project: ${existingPrd.project}

## Existing Tasks:
${existingTasksList || "No existing tasks"}

## New Task Description:
${description}

## Instructions:
1. Create a single task based on the description
2. Make sure it doesn't duplicate existing tasks
3. Write a clear, specific description and actionable steps
4. The task should be small enough to complete in one coding session

## Output Format:
Output ONLY the ${format.toUpperCase()} content for the single task wrapped in markers. Do not include any other text.

${TASK_OUTPUT_START}
${formatExample}
${TASK_OUTPUT_END}

Generate the task now:`;
}
