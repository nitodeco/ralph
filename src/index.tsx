#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import packageJson from "../package.json";
import { InitWizard } from "./components/InitWizard.tsx";
import { RunApp } from "./components/RunApp.tsx";
import { SetupWizard } from "./components/SetupWizard.tsx";
import { UpdatePrompt } from "./components/UpdatePrompt.tsx";
import { globalConfigExists } from "./lib/config.ts";

declare const RALPH_VERSION: string | undefined;

export const VERSION = typeof RALPH_VERSION !== "undefined" ? RALPH_VERSION : packageJson.version;

type Command =
	| "run"
	| "init"
	| "setup"
	| "update"
	| "resume"
	| "help"
	| "version"
	| "-v"
	| "--version"
	| "-h"
	| "--help";

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
  ralph                   Open the Ralph UI (use /start to begin)
  ralph <command>

Commands:
  init              Initialize a new PRD project (AI-generated from description)
  resume            Resume a previously interrupted session
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Slash Commands (in-app):
  /start [n|full]   Start the agent loop (default: 10 iterations, full: all tasks)
  /stop             Stop the running agent
  /resume           Resume a previously interrupted session
  /init             Initialize a new PRD project
  /add              Add a new task to the PRD (AI-generated from description)
  /setup            Configure global preferences
  /update           Check for updates
  /help             Show help message
  /quit             Exit the application

Examples:
  ralph             Open the Ralph UI
  ralph init        Create a new PRD project from a description
  ralph resume      Resume a previously interrupted session
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
	autoResume?: boolean;
}

function RunWithSetup({
	version,
	iterations,
	autoResume = false,
}: RunWithSetupProps): React.ReactElement {
	const [setupComplete, setSetupComplete] = useState(globalConfigExists());

	if (!setupComplete) {
		return <SetupWizard version={version} onComplete={() => setSetupComplete(true)} />;
	}

	return <RunApp version={version} iterations={iterations} autoResume={autoResume} />;
}

function main(): void {
	clearTerminal();
	const { command, iterations } = parseArgs(process.argv);

	switch (command) {
		case "run":
			render(<RunWithSetup version={VERSION} iterations={iterations} />);
			break;

		case "resume":
			render(<RunWithSetup version={VERSION} iterations={iterations} autoResume />);
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
		default:
			printHelp();
			break;
	}
}

main();
