#!/usr/bin/env bun

import { type Instance, render } from "ink";
import { useState } from "react";
import {
	handleAnalyzeClear,
	handleAnalyzeExport,
	handleDependencyAdd,
	handleDependencyRemove,
	handleDependencySet,
	handleGuardrailsAdd,
	handleGuardrailsGenerate,
	handleGuardrailsRemove,
	handleGuardrailsToggle,
	handleMemoryClear,
	handleMemoryExport,
	handleMigrateCommand,
	handleProgressAdd,
	handleProgressClear,
	handleProjectsPrune,
	handleRulesAdd,
	handleRulesRemove,
	handleStopCommand,
	handleTaskAdd,
	handleTaskDone,
	handleTaskEdit,
	handleTaskRemove,
	handleTaskUndone,
	parseArgs,
	printAnalyze,
	printArchive,
	printClear,
	printConfig,
	printCurrentProject,
	printCurrentTask,
	printDependencyBlocked,
	printDependencyGraph,
	printDependencyOrder,
	printDependencyReady,
	printDependencyShow,
	printDependencyValidate,
	printGuardrails,
	printHelp,
	printList,
	printMemory,
	printProgress,
	printProjects,
	printRules,
	printStats,
	printStatus,
	printTaskList,
	printTaskShow,
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
import { bootstrapServices, getSleepPreventionService } from "@/lib/services/index.ts";
import { orchestrator, useAgentStore } from "@/stores/index.ts";
import type { Command } from "@/types.ts";
import packageJson from "../package.json";

declare const RALPH_VERSION: string | undefined;

export const VERSION = typeof RALPH_VERSION !== "undefined" ? RALPH_VERSION : packageJson.version;

let maybeInkInstance: Instance | null = null;

export function unmountInk(): void {
	if (maybeInkInstance) {
		maybeInkInstance.unmount();
		maybeInkInstance = null;
	}
}

function clearTerminal(): void {
	process.stdout.write("\x1b[?25h\x1b[2J\x1b[H");
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
	} = parseArgs(process.argv);

	setShutdownHandler({
		onShutdown: () => {
			unmountInk();
			getSleepPreventionService().stop();
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
			getSleepPreventionService().start();
			maybeInkInstance = render(
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
			getSleepPreventionService().start();
			maybeInkInstance = render(
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
			maybeInkInstance = render(<InitWizard version={VERSION} />);
			break;

		case "setup":
			maybeInkInstance = render(<SetupWizard version={VERSION} />);
			break;

		case "update":
			maybeInkInstance = render(<UpdatePrompt version={VERSION} forceCheck />);
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
			printClear(VERSION, force);
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
				case "generate":
					handleGuardrailsGenerate(guardrailsGenerateOptions ?? {}, json);
					break;
				default:
					printGuardrails(VERSION, json);
					break;
			}

			break;

		case "rules":
			switch (rulesSubcommand) {
				case "add":
					handleRulesAdd(rulesArg ?? "");
					break;
				case "remove":
					handleRulesRemove(rulesArg ?? "");
					break;
				default:
					printRules(VERSION, json);
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
					handleMemoryClear(force);
					break;
				default:
					printMemory(json);
					break;
			}

			break;

		case "migrate":
			handleMigrateCommand(VERSION);
			break;

		case "projects":
			switch (projectsSubcommand) {
				case "current":
					printCurrentProject(json);
					break;
				case "prune":
					handleProjectsPrune(json);
					break;
				default:
					printProjects(VERSION, json);
					break;
			}

			break;

		case "task":
			switch (taskSubcommand) {
				case "add":
					handleTaskAdd(taskAddOptions ?? {}, json).catch((error) => {
						console.error("Failed to add task:", error);
						process.exit(1);
					});
					break;
				case "edit":
					handleTaskEdit(taskIdentifier ?? "", taskEditOptions ?? {}, json).catch((error) => {
						console.error("Failed to edit task:", error);
						process.exit(1);
					});
					break;
				case "remove":
					handleTaskRemove(taskIdentifier ?? "", json);
					break;
				case "show":
					printTaskShow(taskIdentifier ?? "", json);
					break;
				case "done":
					handleTaskDone(taskIdentifier ?? "", json);
					break;
				case "undone":
					handleTaskUndone(taskIdentifier ?? "", json);
					break;
				case "current":
					printCurrentTask(json);
					break;
				default:
					printTaskList(json);
					break;
			}

			break;

		case "progress":
			switch (progressSubcommand) {
				case "add":
					handleProgressAdd(progressText ?? "", json);
					break;
				case "clear":
					handleProgressClear(json);
					break;
				default:
					printProgress(json);
					break;
			}

			break;

		case "dependency":
			switch (dependencySubcommand) {
				case "validate":
					printDependencyValidate(json);
					break;
				case "ready":
					printDependencyReady(json);
					break;
				case "blocked":
					printDependencyBlocked(json);
					break;
				case "order":
					printDependencyOrder(json);
					break;
				case "show":
					printDependencyShow(dependencySetOptions?.taskIdentifier ?? "", json);
					break;
				case "set":
					handleDependencySet(
						dependencySetOptions?.taskIdentifier ?? "",
						dependencySetOptions?.dependencies ?? [],
						json,
					);
					break;
				case "add":
					handleDependencyAdd(
						dependencyModifyOptions?.taskIdentifier ?? "",
						dependencyModifyOptions?.dependencyId ?? "",
						json,
					);
					break;
				case "remove":
					handleDependencyRemove(
						dependencyModifyOptions?.taskIdentifier ?? "",
						dependencyModifyOptions?.dependencyId ?? "",
						json,
					);
					break;
				default:
					printDependencyGraph(json);
					break;
			}

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
