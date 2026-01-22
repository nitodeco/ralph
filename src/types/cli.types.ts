export type Command =
	| "run"
	| "init"
	| "setup"
	| "update"
	| "resume"
	| "status"
	| "stats"
	| "stop"
	| "list"
	| "config"
	| "archive"
	| "clear"
	| "guardrails"
	| "rules"
	| "analyze"
	| "memory"
	| "migrate"
	| "projects"
	| "task"
	| "progress"
	| "dependency"
	| "usage"
	| "help"
	| "version"
	| "-v"
	| "--version"
	| "-h"
	| "--help";

export type GuardrailsSubcommand = "list" | "add" | "remove" | "toggle" | "generate";

export interface GuardrailsGenerateOptions {
	apply?: boolean;
}

export type RulesSubcommand = "list" | "add" | "remove";

export type AnalyzeSubcommand = "patterns" | "export" | "clear";
export type MemorySubcommand = "list" | "clear" | "export";
export type ProjectsSubcommand = "list" | "current" | "prune";
export type TaskSubcommand =
	| "list"
	| "done"
	| "undone"
	| "current"
	| "add"
	| "edit"
	| "remove"
	| "show";

export interface TaskAddOptions {
	title?: string;
	description?: string;
	steps?: string[];
	stdin?: boolean;
}

export interface TaskEditOptions {
	title?: string;
	description?: string;
	steps?: string[];
	stdin?: boolean;
}
export type ProgressSubcommand = "show" | "add" | "clear";
export type UsageSubcommand = "show" | "summary" | "sessions" | "daily";
export type DependencySubcommand =
	| "graph"
	| "validate"
	| "ready"
	| "blocked"
	| "order"
	| "show"
	| "set"
	| "add"
	| "remove";

export interface DependencySetOptions {
	taskIdentifier: string;
	dependencies: string[];
}

export interface DependencyModifyOptions {
	taskIdentifier: string;
	dependencyId: string;
}

export interface ParsedArgs {
	command: Command;
	iterations: number;
	background: boolean;
	json: boolean;
	dryRun: boolean;
	verbose: boolean;
	force: boolean;
	task?: string;
	maxRuntimeMs?: number;
	skipVerification: boolean;
	guardrailsSubcommand?: GuardrailsSubcommand;
	guardrailsArg?: string;
	guardrailsGenerateOptions?: GuardrailsGenerateOptions;
	analyzeSubcommand?: AnalyzeSubcommand;
	memorySubcommand?: MemorySubcommand;
	projectsSubcommand?: ProjectsSubcommand;
	taskSubcommand?: TaskSubcommand;
	taskIdentifier?: string;
	taskAddOptions?: TaskAddOptions;
	taskEditOptions?: TaskEditOptions;
	progressSubcommand?: ProgressSubcommand;
	progressText?: string;
	dependencySubcommand?: DependencySubcommand;
	dependencySetOptions?: DependencySetOptions;
	dependencyModifyOptions?: DependencyModifyOptions;
	rulesSubcommand?: RulesSubcommand;
	rulesArg?: string;
	rulesGlobal?: boolean;
	usageSubcommand?: UsageSubcommand;
	usageLimit?: number;
}

export interface TaskListOutput {
	project: string;
	tasks: Array<{
		index: number;
		title: string;
		description: string;
		status: "done" | "pending";
		steps: string[];
	}>;
	summary: {
		total: number;
		completed: number;
		pending: number;
		percentComplete: number;
	};
}

export interface ConfigOutput {
	global: {
		path: string;
		exists: boolean;
		values: Record<string, unknown> | null;
	};
	project: {
		path: string;
		exists: boolean;
		values: Record<string, unknown> | null;
	};
	effective: Record<string, unknown>;
	validation: {
		valid: boolean;
		errors: Array<{ field: string; message: string; value?: unknown }>;
		warnings: Array<{ field: string; message: string; value?: unknown }>;
	};
}
