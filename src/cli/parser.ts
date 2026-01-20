import { DEFAULTS } from "@/lib/defaults.ts";
import type { Command, ParsedArgs } from "@/types.ts";

export function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const background = relevantArgs.includes("--background") || relevantArgs.includes("-b");
	const json = relevantArgs.includes("--json");
	const dryRun = relevantArgs.includes("--dry-run");
	const verbose = relevantArgs.includes("--verbose");

	let task: string | undefined;
	const taskIndex = relevantArgs.findIndex((arg) => arg === "--task" || arg === "-t");
	if (taskIndex !== -1 && taskIndex + 1 < relevantArgs.length) {
		task = relevantArgs[taskIndex + 1];
	}

	let maxRuntimeMs: number | undefined;
	const maxRuntimeIndex = relevantArgs.findIndex(
		(arg) => arg === "--max-runtime" || arg === "--max-runtime-ms",
	);
	const maxRuntimeValue = relevantArgs[maxRuntimeIndex + 1];
	if (maxRuntimeIndex !== -1 && maxRuntimeValue !== undefined) {
		const parsed = Number.parseInt(maxRuntimeValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			maxRuntimeMs = parsed * 1000;
		}
	}

	const filteredArgs = relevantArgs.filter(
		(arg, argIndex) =>
			arg !== "--background" &&
			arg !== "-b" &&
			arg !== "--daemon-child" &&
			arg !== "--json" &&
			arg !== "--dry-run" &&
			arg !== "--verbose" &&
			arg !== "--task" &&
			arg !== "-t" &&
			arg !== "--max-runtime" &&
			arg !== "--max-runtime-ms" &&
			(taskIndex === -1 || argIndex !== taskIndex + 1) &&
			(maxRuntimeIndex === -1 || argIndex !== maxRuntimeIndex + 1),
	);
	const command = (filteredArgs[0] ?? "run") as Command;

	let iterations: number = DEFAULTS.iterations;
	if (command === "run" || command === "resume") {
		const iterArg = filteredArgs.find((arg) => !arg.startsWith("-") && arg !== command);
		if (iterArg) {
			const parsed = Number.parseInt(iterArg, 10);
			if (!Number.isNaN(parsed) && parsed > 0) {
				iterations = parsed;
			}
		}
	}

	return { command, iterations, background, json, dryRun, verbose, task, maxRuntimeMs };
}
