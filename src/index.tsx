#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import packageJson from "../package.json";
import { InitWizard } from "./components/InitWizard.tsx";
import { RunApp } from "./components/RunApp.tsx";
import { SetupWizard } from "./components/SetupWizard.tsx";
import { UpdatePrompt } from "./components/UpdatePrompt.tsx";
import { globalConfigExists, loadConfig } from "./lib/config.ts";
import {
	cleanupDaemon,
	isBackgroundProcessRunning,
	isDaemonProcess,
	spawnDaemonProcess,
	writePidFile,
} from "./lib/daemon.ts";

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
	background: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const background = relevantArgs.includes("--background") || relevantArgs.includes("-b");
	const filteredArgs = relevantArgs.filter(
		(arg) => arg !== "--background" && arg !== "-b" && arg !== "--daemon-child",
	);
	const command = (filteredArgs[0] ?? "run") as Command;

	let iterations = 10;
	if (command === "run" || command === "resume") {
		const iterArg = filteredArgs.find((arg) => !arg.startsWith("-") && arg !== command);
		if (iterArg) {
			const parsed = Number.parseInt(iterArg, 10);
			if (!Number.isNaN(parsed) && parsed > 0) {
				iterations = parsed;
			}
		}
	}

	return { command, iterations, background };
}

function printHelp(): void {
	console.log(`
◆ ralph v${VERSION}

A CLI tool for long-running PRD-driven development with AI coding agents

Usage:
  ralph                   Open the Ralph UI (use /start to begin)
  ralph <command> [options]

Commands:
  init              Initialize a new PRD project (AI-generated from description)
  resume            Resume a previously interrupted session
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Options:
  -b, --background  Run Ralph in background/daemon mode (detached from terminal)

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
  ralph -b          Start Ralph in background mode (logs to .ralph/ralph.log)
  ralph resume -b   Resume session in background mode
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
	autoStart?: boolean;
}

function RunWithSetup({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
}: RunWithSetupProps): React.ReactElement {
	const [setupComplete, setSetupComplete] = useState(globalConfigExists());

	if (!setupComplete) {
		return <SetupWizard version={version} onComplete={() => setSetupComplete(true)} />;
	}

	return (
		<RunApp
			version={version}
			iterations={iterations}
			autoResume={autoResume}
			autoStart={autoStart}
		/>
	);
}

function handleBackgroundMode(_command: Command, _iterations: number): void {
	const { running, pid } = isBackgroundProcessRunning();
	if (running && pid !== null) {
		console.log(`Ralph is already running in background (PID: ${pid})`);
		console.log("Use 'ralph stop' to stop the background process");
		process.exit(1);
	}

	const config = loadConfig();
	const relevantArgs = process.argv.slice(2);

	const daemonPid = spawnDaemonProcess({
		args: relevantArgs,
		logFilePath: config.logFilePath,
	});

	if (daemonPid !== null) {
		console.log(`Ralph started in background mode (PID: ${daemonPid})`);
		console.log(`Logs are being written to: ${config.logFilePath ?? ".ralph/ralph.log"}`);
		console.log("Use 'ralph status' to check progress");
		console.log("Use 'ralph stop' to stop the background process");
	} else {
		console.error("Failed to start Ralph in background mode");
		process.exit(1);
	}
}

function main(): void {
	const { command, iterations, background } = parseArgs(process.argv);

	if (isDaemonProcess()) {
		writePidFile(process.pid);

		process.on("exit", () => {
			cleanupDaemon();
		});
		process.on("SIGTERM", () => {
			cleanupDaemon();
			process.exit(0);
		});
		process.on("SIGINT", () => {
			cleanupDaemon();
			process.exit(0);
		});
	} else {
		clearTerminal();
	}

	if (background && !isDaemonProcess()) {
		if (command !== "run" && command !== "resume") {
			console.error("Background mode is only supported for 'run' and 'resume' commands");
			process.exit(1);
		}
		handleBackgroundMode(command, iterations);
		return;
	}

	const autoStart = isDaemonProcess();

	switch (command) {
		case "run":
			render(<RunWithSetup version={VERSION} iterations={iterations} autoStart={autoStart} />);
			break;

		case "resume":
			render(
				<RunWithSetup version={VERSION} iterations={iterations} autoResume autoStart={autoStart} />,
			);
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
