export type Command =
	| "run"
	| "init"
	| "setup"
	| "update"
	| "resume"
	| "status"
	| "stop"
	| "list"
	| "config"
	| "help"
	| "version"
	| "-v"
	| "--version"
	| "-h"
	| "--help";

export interface ParsedArgs {
	command: Command;
	iterations: number;
	background: boolean;
	json: boolean;
	dryRun: boolean;
	task?: string;
}

export interface TaskListOutput {
	project: string;
	tasks: Array<{
		index: number;
		title: string;
		description: string;
		status: "done" | "pending" | "blocked";
		steps: string[];
		dependsOn?: string[];
		blockedBy?: string[];
	}>;
	summary: {
		total: number;
		completed: number;
		pending: number;
		blocked: number;
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
