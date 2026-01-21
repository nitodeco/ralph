#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import {
	handleAnalyzeClear,
	handleAnalyzeExport,
	handleGuardrailsAdd,
	handleGuardrailsRemove,
	handleGuardrailsToggle,
	handleMemoryClear,
	handleMemoryExport,
	handleMigrateCommand,
	handleStopCommand,
	parseArgs,
	printAnalyze,
	printArchive,
	printClear,
	printConfig,
	printGuardrails,
	printHelp,
	printList,
	printMemory,
	printStats,
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
import { bootstrapServices } from "@/lib/services/index.ts";
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
	maxRuntimeMs?: number;
	skipVerification?: boolean;
}

function RunWithSetup({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
	dryRun = false,
	initialTask,
	maxRuntimeMs,
	skipVerification = false,
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
			maxRuntimeMs={maxRuntimeMs}
			skipVerification={skipVerification}
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
	bootstrapServices();

	const {
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
	} = parseArgs(process.argv);

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
					maxRuntimeMs={maxRuntimeMs}
					skipVerification={skipVerification}
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
					maxRuntimeMs={maxRuntimeMs}
					skipVerification={skipVerification}
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
			printStatus(VERSION, verbose);
			break;

		case "stats":
			printStats(VERSION);
			break;

		case "list":
			printList(VERSION, json, verbose);
			break;

		case "config":
			printConfig(VERSION, json, verbose);
			break;

		case "archive":
			printArchive(VERSION);
			break;

		case "clear":
			printClear(VERSION);
			break;

		case "guardrails":
			switch (guardrailsSubcommand) {
				case "add":
					handleGuardrailsAdd(guardrailsArg ?? "");
					break;
				case "remove":
					handleGuardrailsRemove(guardrailsArg ?? "");
					break;
				case "toggle":
					handleGuardrailsToggle(guardrailsArg ?? "");
					break;
				default:
					printGuardrails(VERSION, json);
					break;
			}

			break;

		case "analyze":
			switch (analyzeSubcommand) {
				case "export":
					handleAnalyzeExport();
					break;
				case "clear":
					handleAnalyzeClear();
					break;
				default:
					printAnalyze(json);
					break;
			}

			break;

		case "memory":
			switch (memorySubcommand) {
				case "export":
					handleMemoryExport();
					break;
				case "clear":
					handleMemoryClear();
					break;
				default:
					printMemory(json);
					break;
			}

			break;

		case "migrate":
			handleMigrateCommand(VERSION, process.argv.includes("--remove"));
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
