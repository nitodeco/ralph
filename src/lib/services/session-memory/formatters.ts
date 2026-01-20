import type { SessionMemory } from "./types.ts";

export function formatForPrompt(memory: SessionMemory): string {
	const sections: string[] = [];

	if (memory.lessonsLearned.length > 0) {
		const lessonsSection = memory.lessonsLearned.map((lesson) => `- ${lesson}`).join("\n");

		sections.push(`### Lessons Learned\n${lessonsSection}`);
	}

	if (memory.successfulPatterns.length > 0) {
		const patternsSection = memory.successfulPatterns.map((pattern) => `- ${pattern}`).join("\n");

		sections.push(`### Successful Patterns\n${patternsSection}`);
	}

	if (memory.failedApproaches.length > 0) {
		const failedSection = memory.failedApproaches
			.map((approach) => `- Avoid: ${approach}`)
			.join("\n");

		sections.push(`### Approaches to Avoid\n${failedSection}`);
	}

	if (sections.length === 0) {
		return "";
	}

	return `## Lessons from Previous Sessions\n${sections.join("\n\n")}\n`;
}

export function formatForTask(taskNote: string | null): string {
	if (!taskNote) {
		return "";
	}

	return `### Notes for this task\n${taskNote}\n`;
}

export function exportAsMarkdown(memory: SessionMemory): string {
	const lines: string[] = [
		`# Session Memory: ${memory.projectName}`,
		"",
		`Last updated: ${memory.lastUpdated}`,
		"",
	];

	if (memory.lessonsLearned.length > 0) {
		lines.push("## Lessons Learned");
		lines.push("");

		for (const lesson of memory.lessonsLearned) {
			lines.push(`- ${lesson}`);
		}

		lines.push("");
	}

	if (memory.successfulPatterns.length > 0) {
		lines.push("## Successful Patterns");
		lines.push("");

		for (const pattern of memory.successfulPatterns) {
			lines.push(`- ${pattern}`);
		}

		lines.push("");
	}

	if (memory.failedApproaches.length > 0) {
		lines.push("## Failed Approaches");
		lines.push("");

		for (const approach of memory.failedApproaches) {
			lines.push(`- ${approach}`);
		}

		lines.push("");
	}

	const taskTitles = Object.keys(memory.taskNotes);

	if (taskTitles.length > 0) {
		lines.push("## Task Notes");
		lines.push("");

		for (const taskTitle of taskTitles) {
			lines.push(`### ${taskTitle}`);
			lines.push("");
			lines.push(memory.taskNotes[taskTitle] ?? "");
			lines.push("");
		}
	}

	return lines.join("\n");
}
