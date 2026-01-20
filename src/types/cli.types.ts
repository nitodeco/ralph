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
	| "guardrails"
	| "help"
	| "version"
	| "-v"
	| "--version"
	| "-h"
	| "--help";

export type GuardrailsSubcommand = "list" | "add" | "remove" | "toggle";

export interface ParsedArgs {
	command: Command;
	iterations: number;
	background: boolean;
	json: boolean;
	dryRun: boolean;
	verbose: boolean;
	task?: string;
	maxRuntimeMs?: number;
	skipVerification: boolean;
	guardrailsSubcommand?: GuardrailsSubcommand;
	guardrailsArg?: string;
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
