#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import {
	handleStopCommand,
	parseArgs,
	printArchive,
	printConfig,
	printHelp,
	printList,
	printStatus,
	printVersion,
} from "@/cli/index.ts";
import { InitWizard } from "@/components/InitWizard.tsx";
import { RunApp } from "@/components/RunApp.tsx";
import { SetupWizard } from "@/components/SetupWizard.tsx";
import { UpdatePrompt } from "@/components/UpdatePrompt.tsx";
import { globalConfigExists, loadConfig } from "@/lib/config.ts";
import {
	isBackgroundProcessRunning,
	isDaemonProcess,
	setShutdownHandler,
	setupSignalHandlers,
	spawnDaemonProcess,
	writePidFile,
} from "@/lib/daemon.ts";
import { checkRalphDirectoryIntegrity, formatIntegrityIssues } from "@/lib/integrity.ts";
import { orchestrator, useAgentStore } from "@/stores/index.ts";
import type { Command } from "@/types.ts";
import packageJson from "../package.json";

declare const RALPH_VERSION: string | undefined;

export const VERSION = typeof RALPH_VERSION !== "undefined" ? RALPH_VERSION : packageJson.version;

function clearTerminal(): void {
	process.stdout.write("\x1b[2J\x1b[H");
}

interface RunWithSetupProps {
	version: string;
	iterations: number;
	autoResume?: boolean;
	autoStart?: boolean;
	dryRun?: boolean;
	initialTask?: string;
}

function RunWithSetup({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
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
			autoStart={autoStart || !!initialTask}
			dryRun={dryRun}
			initialTask={initialTask}
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
	const { command, iterations, background, json, dryRun, task } = parseArgs(process.argv);

	setShutdownHandler({
		onShutdown: () => {
			orchestrator.cleanup();
			const agentStore = useAgentStore.getState();
			agentStore.stop();
		},
	});

	setupSignalHandlers();

	const integrityResult = checkRalphDirectoryIntegrity();
	const integrityWarnings = formatIntegrityIssues(integrityResult);

	if (isDaemonProcess()) {
		writePidFile(process.pid);
	} else {
		clearTerminal();
		if (integrityWarnings) {
			console.warn(integrityWarnings);
		}
	}

	if (background && !isDaemonProcess()) {
		if (command !== "run" && command !== "resume") {
			console.error("Background mode is only supported for 'run' and 'resume' commands");
			process.exit(1);
		}
		if (dryRun) {
			console.error("Dry-run mode cannot be used with background mode");
			process.exit(1);
		}
		handleBackgroundMode(command, iterations);
		return;
	}

	const autoStart = isDaemonProcess() || dryRun;

	switch (command) {
		case "run":
			render(
				<RunWithSetup
					version={VERSION}
					iterations={task ? 1 : iterations}
					autoStart={autoStart}
					dryRun={dryRun}
					initialTask={task}
				/>,
			);
			break;

		case "resume":
			render(
				<RunWithSetup
					version={VERSION}
					iterations={iterations}
					autoResume
					autoStart={autoStart}
					dryRun={dryRun}
					initialTask={task}
				/>,
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

		case "status":
			printStatus(VERSION);
			break;

		case "list":
			printList(VERSION, json);
			break;

		case "config":
			printConfig(VERSION, json);
			break;

		case "archive":
			printArchive(VERSION);
			break;

		case "stop":
			handleStopCommand(VERSION).catch((error) => {
				console.error("Failed to stop:", error);
				process.exit(1);
			});
			return;

		case "version":
		case "-v":
		case "--version":
			printVersion(VERSION);
			break;

		default:
			printHelp(VERSION);
			break;
	}
}

main();
