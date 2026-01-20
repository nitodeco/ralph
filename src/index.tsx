#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import { InitWizard } from "./components/InitWizard.tsx";
import { RunApp } from "./components/RunApp.tsx";
import { SetupWizard } from "./components/SetupWizard.tsx";
import { UpdatePrompt } from "./components/UpdatePrompt.tsx";
import { globalConfigExists } from "./lib/config.ts";

export const VERSION = "1.0.0";

type Command = "run" | "init" | "setup" | "update" | "help" | "version" | "-v" | "--version" | "-h" | "--help";

interface ParsedArgs {
	command: Command;
	iterations: number;
}

function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const command = (relevantArgs[0] ?? "run") as Command;

	let iterations = 10;
	if (command === "run" && relevantArgs[1]) {
		const parsed = Number.parseInt(relevantArgs[1], 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			iterations = parsed;
		}
	}

	return { command, iterations };
}

function printHelp(): void {
	console.log(`
◆ ralph v${VERSION}

A CLI tool for long-running PRD-driven development with AI coding agents

Usage:
  ralph [iterations]      Run the agent loop (default: 10 iterations)
  ralph <command>

Commands:
  init              Initialize a new PRD project
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Examples:
  ralph             Run 10 iterations
  ralph 5           Run 5 iterations
  ralph init        Create a new PRD project
  ralph update      Check for and install updates
`);
}

function printVersion(): void {
	console.log(`ralph v${VERSION}`);
}

function clearTerminal(): void {
	process.stdout.write("\x1b[2J\x1b[H");
}

interface RunWithSetupProps {
	version: string;
	iterations: number;
}

function RunWithSetup({ version, iterations }: RunWithSetupProps): React.ReactElement {
	const [setupComplete, setSetupComplete] = useState(globalConfigExists());

	if (!setupComplete) {
		return <SetupWizard version={version} onComplete={() => setSetupComplete(true)} />;
	}

	return <RunApp version={version} iterations={iterations} />;
}

function main(): void {
	clearTerminal();
	const { command, iterations } = parseArgs(process.argv);

	switch (command) {
		case "run":
			render(<RunWithSetup version={VERSION} iterations={iterations} />);
			break;

		case "init":
			render(<InitWizard version={VERSION} />);
			break;

		case "setup":
			render(<SetupWizard version={VERSION} />);
			break;

		case "update":
			render(<UpdatePrompt version={VERSION} forceCheck />);
			break;

		case "version":
		case "-v":
		case "--version":
			printVersion();
			break;

		case "help":
		case "-h":
		case "--help":
		default:
			printHelp();
			break;
	}
}

main();
