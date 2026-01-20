import { DEFAULTS } from "@/lib/defaults.ts";
import type {
	AnalyzeSubcommand,
	Command,
	GuardrailsSubcommand,
	MemorySubcommand,
	ParsedArgs,
} from "@/types.ts";

const VALID_GUARDRAILS_SUBCOMMANDS: GuardrailsSubcommand[] = ["list", "add", "remove", "toggle"];
const VALID_ANALYZE_SUBCOMMANDS: AnalyzeSubcommand[] = ["patterns", "export", "clear"];
const VALID_MEMORY_SUBCOMMANDS: MemorySubcommand[] = ["list", "clear", "export"];

export function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const background = relevantArgs.includes("--background") || relevantArgs.includes("-b");
	const json = relevantArgs.includes("--json");
	const dryRun = relevantArgs.includes("--dry-run");
	const verbose = relevantArgs.includes("--verbose");
	const skipVerification = relevantArgs.includes("--skip-verification");

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
			arg !== "--skip-verification" &&
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

	let guardrailsSubcommand: GuardrailsSubcommand | undefined;
	let guardrailsArg: string | undefined;

	if (command === "guardrails") {
		const subcommand = filteredArgs[1] as GuardrailsSubcommand | undefined;
		if (subcommand && VALID_GUARDRAILS_SUBCOMMANDS.includes(subcommand)) {
			guardrailsSubcommand = subcommand;
			guardrailsArg = filteredArgs.slice(2).join(" ");
		} else if (subcommand && !subcommand.startsWith("-")) {
			guardrailsSubcommand = "add";
			guardrailsArg = filteredArgs.slice(1).join(" ");
		} else {
			guardrailsSubcommand = "list";
		}
	}

	let analyzeSubcommand: AnalyzeSubcommand | undefined;

	if (command === "analyze") {
		const subcommand = filteredArgs[1] as AnalyzeSubcommand | undefined;
		if (subcommand && VALID_ANALYZE_SUBCOMMANDS.includes(subcommand)) {
			analyzeSubcommand = subcommand;
		} else {
			analyzeSubcommand = "patterns";
		}
	}

	let memorySubcommand: MemorySubcommand | undefined;

	if (command === "memory") {
		const subcommand = filteredArgs[1] as MemorySubcommand | undefined;
		if (subcommand && VALID_MEMORY_SUBCOMMANDS.includes(subcommand)) {
			memorySubcommand = subcommand;
		} else {
			memorySubcommand = "list";
		}
	}

	return {
		command,
		iterations,
		background,
		json,
		dryRun,
		verbose,
		task,
		maxRuntimeMs,
		skipVerification,
		guardrailsSubcommand,
		guardrailsArg,
		analyzeSubcommand,
		memorySubcommand,
	};
}
