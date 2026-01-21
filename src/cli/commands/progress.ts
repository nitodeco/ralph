import { writeFileSync } from "node:fs";
import { ensureProjectDirExists } from "@/lib/paths.ts";
import { appendProgress, getProgressFilePath, readProgressFile } from "@/lib/progress.ts";

interface ProgressShowJsonOutput {
	content: string | null;
	isEmpty: boolean;
}

interface ProgressAddJsonOutput {
	success: boolean;
	text: string;
}

interface ProgressClearJsonOutput {
	success: boolean;
}

export function printProgress(jsonOutput: boolean): void {
	const content = readProgressFile();
	const isEmpty = content === null || content.trim() === "";

	if (jsonOutput) {
		const output: ProgressShowJsonOutput = {
			content,
			isEmpty,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	if (isEmpty) {
		console.log("No progress recorded yet.");
		console.log("\nAdd progress with: ralph progress add <text>");

		return;
	}

	console.log("Progress:\n");
	console.log(content);
}

export function handleProgressAdd(text: string, jsonOutput: boolean): void {
	if (!text.trim()) {
		if (jsonOutput) {
			console.log(JSON.stringify({ error: "Text is required", code: "MISSING_TEXT" }, null, 2));
		} else {
			console.error("\x1b[31mError:\x1b[0m Text is required");
			console.log("\nUsage: ralph progress add <text>");
		}

		process.exit(1);
	}

	appendProgress(text.trim());

	if (jsonOutput) {
		const output: ProgressAddJsonOutput = {
			success: true,
			text: text.trim(),
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`\x1b[32m✓\x1b[0m Added to progress: "${text.trim()}"`);
}

export function handleProgressClear(jsonOutput: boolean): void {
	ensureProjectDirExists();
	writeFileSync(getProgressFilePath(), "");

	if (jsonOutput) {
		const output: ProgressClearJsonOutput = {
			success: true,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("\x1b[32m✓\x1b[0m Progress cleared");
}
