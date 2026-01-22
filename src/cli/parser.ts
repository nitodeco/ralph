import { DEFAULTS } from "@/lib/constants/defaults.ts";
import type {
	AnalyzeSubcommand,
	Command,
	DependencyModifyOptions,
	DependencySetOptions,
	DependencySubcommand,
	GitHubSubcommand,
	GuardrailsGenerateOptions,
	GuardrailsSubcommand,
	MemorySubcommand,
	ParsedArgs,
	ProgressSubcommand,
	ProjectsSubcommand,
	RulesSubcommand,
	TaskAddOptions,
	TaskEditOptions,
	TaskSubcommand,
	UsageSubcommand,
} from "@/types.ts";

const VALID_GUARDRAILS_SUBCOMMANDS: GuardrailsSubcommand[] = [
	"list",
	"add",
	"remove",
	"toggle",
	"generate",
];
const VALID_ANALYZE_SUBCOMMANDS: AnalyzeSubcommand[] = ["patterns", "export", "clear"];
const VALID_MEMORY_SUBCOMMANDS: MemorySubcommand[] = ["list", "clear", "export"];
const VALID_PROJECTS_SUBCOMMANDS: ProjectsSubcommand[] = ["list", "current", "prune"];
const VALID_TASK_SUBCOMMANDS: TaskSubcommand[] = [
	"list",
	"done",
	"undone",
	"current",
	"add",
	"edit",
	"remove",
	"show",
];
const VALID_PROGRESS_SUBCOMMANDS: ProgressSubcommand[] = ["show", "add", "clear"];
const VALID_DEPENDENCY_SUBCOMMANDS: DependencySubcommand[] = [
	"graph",
	"validate",
	"ready",
	"blocked",
	"order",
	"show",
	"set",
	"add",
	"remove",
];
const VALID_RULES_SUBCOMMANDS: RulesSubcommand[] = ["list", "add", "remove"];
const VALID_USAGE_SUBCOMMANDS: UsageSubcommand[] = ["show", "summary", "sessions", "daily"];
const VALID_GITHUB_SUBCOMMANDS: GitHubSubcommand[] = ["show", "set-token", "clear-token"];

function parseTaskAddOptions(args: string[]): TaskAddOptions {
	const options: TaskAddOptions = {};

	for (let argIndex = 0; argIndex < args.length; argIndex++) {
		const arg = args.at(argIndex);

		if (arg === "--stdin") {
			options.stdin = true;
		} else if (arg === "--title" && argIndex + 1 < args.length) {
			options.title = args.at(argIndex + 1);
			argIndex++;
		} else if (arg === "--description" && argIndex + 1 < args.length) {
			options.description = args.at(argIndex + 1);
			argIndex++;
		} else if (arg === "--steps" && argIndex + 1 < args.length) {
			if (!options.steps) {
				options.steps = [];
			}

			const step = args.at(argIndex + 1);

			if (step) {
				options.steps.push(step);
			}

			argIndex++;
		}
	}

	return options;
}

function parseTaskEditOptions(args: string[]): TaskEditOptions {
	const options: TaskEditOptions = {};

	for (let argIndex = 0; argIndex < args.length; argIndex++) {
		const arg = args.at(argIndex);

		if (arg === "--stdin") {
			options.stdin = true;
		} else if (arg === "--title" && argIndex + 1 < args.length) {
			options.title = args.at(argIndex + 1);
			argIndex++;
		} else if (arg === "--description" && argIndex + 1 < args.length) {
			options.description = args.at(argIndex + 1);
			argIndex++;
		} else if (arg === "--steps" && argIndex + 1 < args.length) {
			if (!options.steps) {
				options.steps = [];
			}

			const step = args.at(argIndex + 1);

			if (step) {
				options.steps.push(step);
			}

			argIndex++;
		}
	}

	return options;
}

export function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const background = relevantArgs.includes("--background") || relevantArgs.includes("-b");
	const json = relevantArgs.includes("--json");
	const dryRun = relevantArgs.includes("--dry-run");
	const verbose = relevantArgs.includes("--verbose");
	const skipVerification = relevantArgs.includes("--skip-verification");
	const force = relevantArgs.includes("--force") || relevantArgs.includes("-f");

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
			arg !== "--force" &&
			arg !== "-f" &&
			(taskIndex === -1 || argIndex !== taskIndex + 1) &&
			(maxRuntimeIndex === -1 || argIndex !== maxRuntimeIndex + 1),
	);
	const command = (filteredArgs.at(0) ?? "run") as Command;

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
	let guardrailsGenerateOptions: GuardrailsGenerateOptions | undefined;

	if (command === "guardrails") {
		const subcommand = filteredArgs.at(1) as GuardrailsSubcommand | undefined;

		if (subcommand && VALID_GUARDRAILS_SUBCOMMANDS.includes(subcommand)) {
			guardrailsSubcommand = subcommand;

			if (subcommand === "generate") {
				guardrailsGenerateOptions = {
					apply: relevantArgs.includes("--apply"),
				};
			} else {
				guardrailsArg = filteredArgs.slice(2).join(" ");
			}
		} else if (subcommand && !subcommand.startsWith("-")) {
			guardrailsSubcommand = "add";
			guardrailsArg = filteredArgs.slice(1).join(" ");
		} else {
			guardrailsSubcommand = "list";
		}
	}

	let analyzeSubcommand: AnalyzeSubcommand | undefined;

	if (command === "analyze") {
		const subcommand = filteredArgs.at(1) as AnalyzeSubcommand | undefined;

		if (subcommand && VALID_ANALYZE_SUBCOMMANDS.includes(subcommand)) {
			analyzeSubcommand = subcommand;
		} else {
			analyzeSubcommand = "patterns";
		}
	}

	let memorySubcommand: MemorySubcommand | undefined;

	if (command === "memory") {
		const subcommand = filteredArgs.at(1) as MemorySubcommand | undefined;

		if (subcommand && VALID_MEMORY_SUBCOMMANDS.includes(subcommand)) {
			memorySubcommand = subcommand;
		} else {
			memorySubcommand = "list";
		}
	}

	let projectsSubcommand: ProjectsSubcommand | undefined;

	if (command === "projects") {
		const subcommand = filteredArgs.at(1) as ProjectsSubcommand | undefined;

		if (subcommand && VALID_PROJECTS_SUBCOMMANDS.includes(subcommand)) {
			projectsSubcommand = subcommand;
		} else {
			projectsSubcommand = "list";
		}
	}

	let taskSubcommand: TaskSubcommand | undefined;
	let taskIdentifier: string | undefined;
	let taskAddOptions: TaskAddOptions | undefined;
	let taskEditOptions: TaskEditOptions | undefined;

	if (command === "task") {
		const subcommand = filteredArgs.at(1) as TaskSubcommand | undefined;

		if (subcommand && VALID_TASK_SUBCOMMANDS.includes(subcommand)) {
			taskSubcommand = subcommand;

			if (subcommand === "done" || subcommand === "undone") {
				taskIdentifier = filteredArgs.slice(2).join(" ");
			} else if (subcommand === "show" || subcommand === "remove") {
				taskIdentifier = filteredArgs.at(2);
			} else if (subcommand === "edit") {
				taskIdentifier = filteredArgs.at(2);
				taskEditOptions = parseTaskEditOptions(filteredArgs.slice(3));
			} else if (subcommand === "add") {
				taskAddOptions = parseTaskAddOptions(filteredArgs.slice(2));
			}
		} else {
			taskSubcommand = "list";
		}
	}

	let progressSubcommand: ProgressSubcommand | undefined;
	let progressText: string | undefined;

	if (command === "progress") {
		const subcommand = filteredArgs.at(1) as ProgressSubcommand | undefined;

		if (subcommand && VALID_PROGRESS_SUBCOMMANDS.includes(subcommand)) {
			progressSubcommand = subcommand;

			if (subcommand === "add") {
				progressText = filteredArgs.slice(2).join(" ");
			}
		} else if (subcommand && !subcommand.startsWith("-")) {
			progressSubcommand = "add";
			progressText = filteredArgs.slice(1).join(" ");
		} else {
			progressSubcommand = "show";
		}
	}

	let dependencySubcommand: DependencySubcommand | undefined;
	let dependencySetOptions: DependencySetOptions | undefined;
	let dependencyModifyOptions: DependencyModifyOptions | undefined;

	if (command === "dependency") {
		const subcommand = filteredArgs.at(1) as DependencySubcommand | undefined;

		if (subcommand && VALID_DEPENDENCY_SUBCOMMANDS.includes(subcommand)) {
			dependencySubcommand = subcommand;

			if (subcommand === "show") {
				const taskIdentifierArg = filteredArgs.at(2);

				dependencySetOptions = {
					taskIdentifier: taskIdentifierArg ?? "",
					dependencies: [],
				};
			} else if (subcommand === "set") {
				const taskIdentifierArg = filteredArgs.at(2) ?? "";
				const dependencies = filteredArgs.slice(3);

				dependencySetOptions = {
					taskIdentifier: taskIdentifierArg,
					dependencies,
				};
			} else if (subcommand === "add" || subcommand === "remove") {
				const taskIdentifierArg = filteredArgs.at(2) ?? "";
				const dependencyId = filteredArgs.at(3) ?? "";

				dependencyModifyOptions = {
					taskIdentifier: taskIdentifierArg,
					dependencyId,
				};
			}
		} else {
			dependencySubcommand = "graph";
		}
	}

	let rulesSubcommand: RulesSubcommand | undefined;
	let rulesArg: string | undefined;
	let rulesGlobal: boolean | undefined;

	if (command === "rules") {
		const subcommand = filteredArgs.at(1) as RulesSubcommand | undefined;

		rulesGlobal = relevantArgs.includes("--global") || relevantArgs.includes("-g");
		const rulesFilteredArgs = filteredArgs.filter((arg) => arg !== "--global" && arg !== "-g");

		if (subcommand && VALID_RULES_SUBCOMMANDS.includes(subcommand)) {
			rulesSubcommand = subcommand;
			rulesArg = rulesFilteredArgs.slice(2).join(" ");
		} else if (subcommand && !subcommand.startsWith("-")) {
			rulesSubcommand = "add";
			rulesArg = rulesFilteredArgs.slice(1).join(" ");
		} else {
			rulesSubcommand = "list";
		}
	}

	let usageSubcommand: UsageSubcommand | undefined;
	let usageLimit: number | undefined;

	if (command === "usage") {
		const subcommand = filteredArgs.at(1) as UsageSubcommand | undefined;

		if (subcommand && VALID_USAGE_SUBCOMMANDS.includes(subcommand)) {
			usageSubcommand = subcommand;

			const limitArg = filteredArgs.at(2);

			if (limitArg) {
				const parsed = Number.parseInt(limitArg, 10);

				if (!Number.isNaN(parsed) && parsed > 0) {
					usageLimit = parsed;
				}
			}
		} else {
			usageSubcommand = "show";
		}
	}

	let githubSubcommand: GitHubSubcommand | undefined;
	let githubToken: string | undefined;

	if (command === "github") {
		const subcommand = filteredArgs.at(1) as GitHubSubcommand | undefined;

		if (subcommand && VALID_GITHUB_SUBCOMMANDS.includes(subcommand)) {
			githubSubcommand = subcommand;

			if (subcommand === "set-token") {
				githubToken = filteredArgs.at(2);
			}
		} else {
			githubSubcommand = "show";
		}
	}

	return {
		command,
		iterations,
		background,
		json,
		dryRun,
		verbose,
		force,
		task,
		maxRuntimeMs,
		skipVerification,
		guardrailsSubcommand,
		guardrailsArg,
		guardrailsGenerateOptions,
		analyzeSubcommand,
		memorySubcommand,
		projectsSubcommand,
		taskSubcommand,
		taskIdentifier,
		taskAddOptions,
		taskEditOptions,
		progressSubcommand,
		progressText,
		dependencySubcommand,
		dependencySetOptions,
		dependencyModifyOptions,
		rulesSubcommand,
		rulesArg,
		rulesGlobal,
		usageSubcommand,
		usageLimit,
		githubSubcommand,
		githubToken,
	};
}
