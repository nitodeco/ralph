import { getGuardrailsService, getSessionMemoryService } from "@/lib/services/index.ts";
import type { Prd } from "@/types.ts";

export const COMPLETION_MARKER = "<promise>COMPLETE</promise>";
export const DECOMPOSITION_MARKER = "<request>DECOMPOSE_TASK</request>";
export const PRD_OUTPUT_START = "<prd_output>";
export const PRD_OUTPUT_END = "</prd_output>";
export const TASK_OUTPUT_START = "<task_output>";
export const TASK_OUTPUT_END = "</task_output>";
export const DECOMPOSITION_OUTPUT_START = "<decomposition_output>";
export const DECOMPOSITION_OUTPUT_END = "</decomposition_output>";
export const PLAN_OUTPUT_START = "<plan_output>";
export const PLAN_OUTPUT_END = "</plan_output>";

export interface BuildPromptOptions {
	instructions?: string | null;
	specificTask?: string | null;
	includeGuardrails?: boolean;
	includeMemory?: boolean;
	isGitRepository?: boolean;
}

export function buildPrompt(options: BuildPromptOptions = {}): string {
	const {
		instructions,
		specificTask,
		includeGuardrails = true,
		includeMemory = true,
		isGitRepository = true,
	} = options;

	const instructionsSection = instructions ? `\n## Project Instructions\n${instructions}\n` : "";

	const guardrailsService = getGuardrailsService();
	const guardrailsSection = includeGuardrails
		? guardrailsService.formatForPrompt(guardrailsService.getActive())
		: "";

	let memorySection = "";

	if (includeMemory) {
		const sessionMemoryService = getSessionMemoryService();
		const generalMemory = sessionMemoryService.formatForPrompt();
		const taskMemory = specificTask ? sessionMemoryService.formatForTask(specificTask) : "";

		if (generalMemory || taskMemory) {
			memorySection = `${generalMemory}${taskMemory}`;
		}
	}

	const taskSelectionInstruction = specificTask
		? `2. Work on the SPECIFIED task: "${specificTask}"`
		: "2. Run 'ralph task current' to see the next task to work on";

	const commitStep = isGitRepository
		? "7. Stage and commit your changes with a meaningful commit message"
		: "7. Verify all changes are complete (note: this is not a git repository, so no commit is needed)";

	const commitRule = isGitRepository ? "- If the build fails, fix it before committing" : "";

	const decompositionInstructions = `
## Task Decomposition
If a task is too large or complex to complete in one iteration, you may request decomposition:
1. Output the marker: ${DECOMPOSITION_MARKER}
2. Immediately after, output a JSON payload wrapped in ${DECOMPOSITION_OUTPUT_START} and ${DECOMPOSITION_OUTPUT_END} tags
3. The JSON must contain: originalTaskTitle (string), reason (string), suggestedSubtasks (array of {title, description, steps})
4. Each subtask should be small enough to complete in one iteration
5. Do NOT mark the original task as done - the system will replace it with subtasks

Example:
${DECOMPOSITION_MARKER}
${DECOMPOSITION_OUTPUT_START}
{
  "originalTaskTitle": "Implement user authentication system",
  "reason": "This task involves multiple complex subsystems that should be implemented separately",
  "suggestedSubtasks": [
    {"title": "Add user model and database schema", "description": "Create the user entity", "steps": ["Create user model", "Add migration"]},
    {"title": "Implement login endpoint", "description": "Create login API", "steps": ["Add route", "Add validation"]}
  ]
}
${DECOMPOSITION_OUTPUT_END}`;

	return `You are a coding agent working on a long running project.
Your workflow is as follows:
1. Get oriented by running 'ralph progress' and 'ralph task list'
${taskSelectionInstruction}
3. Implement ONLY that task
4. Verify your implementation
5. Record your progress by running: ralph progress add <summary of what you did>
6. Mark the task as done by running: ralph task done <task-number>
${commitStep}

## Rules
- ONLY work on ONE task at a time
- Always leave the codebase in a buildable state
${commitRule}${commitRule ? "\n" : ""}- Ensure you are using the proper tools in this project
${instructionsSection}${guardrailsSection ? `\n${guardrailsSection}` : ""}${memorySection ? `\n${memorySection}` : ""}${decompositionInstructions}

IMPORTANT:
- Use 'ralph progress' to see previous progress notes
- Use 'ralph progress add <text>' to record your progress
- Use 'ralph task list' to see all tasks and their status
- Use 'ralph task current' to see the next pending task
- Use 'ralph task done <n>' to mark task n as complete (1-based index)
- If 'ralph task current' shows "All tasks complete!", output EXACTLY this: <promise>COMPLETE</promise>
`;
}

export function buildPrdGenerationPrompt(description: string): string {
	const formatExample = `{
  "project": "Project Name",
  "tasks": [
    {
      "title": "Task 1 Title",
      "description": "Detailed description of what this task accomplishes",
      "steps": ["Step 1", "Step 2"],
      "done": false
    },
    {
      "title": "Task 2 Title",
      "description": "Another task",
      "steps": ["Step 1"],
      "done": false
    }
  ]
}`;

	return `You are a project planning assistant. Based on the user's description, generate a complete PRD (Product Requirements Document) in JSON format.

## User's Project Description:
${description}

## Instructions:
1. Analyze the description and break it down into logical, actionable tasks
2. Each task should be small enough to complete in one coding session
3. Order tasks logically so that foundational tasks come before tasks that build upon them
4. Write clear, specific descriptions and steps for each task
5. Generate a meaningful project name based on the description

## Output Format:
Output ONLY the JSON content wrapped in markers. Do not include any other text.

${PRD_OUTPUT_START}
${formatExample}
${PRD_OUTPUT_END}

Generate the PRD now:`;
}

export function buildAddTaskPrompt(description: string, existingPrd: Prd): string {
	const formatExample = `{
  "title": "Task Title",
  "description": "Detailed description of what this task accomplishes",
  "steps": ["Step 1", "Step 2"],
  "done": false
}`;

	const existingTasksList = existingPrd.tasks
		.map((task, taskIndex) => `${taskIndex + 1}. ${task.title}${task.done ? " (done)" : ""}`)
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
Output ONLY the JSON content for the single task wrapped in markers. Do not include any other text.

${TASK_OUTPUT_START}
${formatExample}
${TASK_OUTPUT_END}

Generate the task now:`;
}

export function buildPlanPrompt(specification: string, existingPrd: Prd | null): string {
	const existingTasksSection = existingPrd
		? `## Existing Tasks (Project: ${existingPrd.project})

${existingPrd.tasks
	.map(
		(task, idx) => `### Task ${idx + 1}: ${task.title}${task.done ? " [DONE]" : ""}
Description: ${task.description}
Steps:
${task.steps.map((step, stepIdx) => `  ${stepIdx + 1}. ${step}`).join("\n")}`,
	)
	.join("\n\n")}

## Available Commands

To ADD a new task:
ralph task add --stdin <<EOF
{"title": "Task title", "description": "Task description", "steps": ["Step 1", "Step 2"]}
EOF

To EDIT an existing task (by number):
ralph task edit <n> --stdin <<EOF
{"title": "New title", "description": "New description", "steps": ["New step 1", "New step 2"]}
EOF

To REMOVE a task:
ralph task remove <n>

## IMPORTANT Rules:
- ONLY modify tasks that are directly relevant to the specification
- Do NOT touch tasks that are unrelated to the specification
- Preserve the done status of tasks (edit does not change done status)
- Run 'ralph task list' after making changes to verify
`
		: `## No existing PRD

Create tasks using:
ralph task add --stdin <<EOF
{"title": "Task title", "description": "Task description", "steps": ["Step 1", "Step 2"]}
EOF
`;

	return `You are a project planning assistant. Based on the user's specification, create or modify tasks in the PRD.

## User's Specification:
${specification}

${existingTasksSection}
Now analyze the specification and execute the necessary task commands. After each command, verify with 'ralph task list'.`;
}
