#!/usr/bin/env bun

import { render } from "ink";
import { useState } from "react";
import { InitWizard } from "@/components/InitWizard.tsx";
import { RunApp } from "@/components/RunApp.tsx";
import { SetupWizard } from "@/components/SetupWizard.tsx";
import { UpdatePrompt } from "@/components/UpdatePrompt.tsx";
import {
	CONFIG_DEFAULTS,
	formatValidationErrors,
	getEffectiveConfig,
	getGlobalConfigPath,
	getProjectConfigPath,
	globalConfigExists,
	loadConfig,
	validateConfig,
} from "@/lib/config.ts";
import {
	cleanupDaemon,
	isBackgroundProcessRunning,
	isDaemonProcess,
	spawnDaemonProcess,
	stopDaemonProcess,
	writePidFile,
} from "@/lib/daemon.ts";
import { getRecentLogEntries } from "@/lib/logger.ts";
import { loadPrd } from "@/lib/prd.ts";
import { loadSession, saveSession, updateSessionStatus } from "@/lib/session.ts";
import packageJson from "../package.json";

declare const RALPH_VERSION: string | undefined;

export const VERSION = typeof RALPH_VERSION !== "undefined" ? RALPH_VERSION : packageJson.version;

type Command =
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

interface ParsedArgs {
	command: Command;
	iterations: number;
	background: boolean;
	json: boolean;
	task?: string;
}

function parseArgs(args: string[]): ParsedArgs {
	const relevantArgs = args.slice(2);
	const background = relevantArgs.includes("--background") || relevantArgs.includes("-b");
	const json = relevantArgs.includes("--json");

	let task: string | undefined;
	const taskIndex = relevantArgs.findIndex((arg) => arg === "--task" || arg === "-t");
	if (taskIndex !== -1 && taskIndex + 1 < relevantArgs.length) {
		task = relevantArgs[taskIndex + 1];
	}

	const filteredArgs = relevantArgs.filter(
		(arg, argIndex) =>
			arg !== "--background" &&
			arg !== "-b" &&
			arg !== "--daemon-child" &&
			arg !== "--json" &&
			arg !== "--task" &&
			arg !== "-t" &&
			argIndex !== taskIndex + 1,
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

	return { command, iterations, background, json, task };
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
  status            Show current session state, progress, and recent logs
  stop              Stop a running Ralph process gracefully
  list              Display all PRD tasks and their completion status
  config            View current configuration with validation
  setup             Configure global preferences (agent, PRD format)
  update            Check for updates and install the latest version
  help              Show this help message

Options:
  -b, --background  Run Ralph in background/daemon mode (detached from terminal)
  --json            Output in JSON format (for list and config commands)
  -t, --task <n>    Run specific task by number or title (single task mode)

Slash Commands (in-app):
  /start [n|full]   Start the agent loop (default: 10 iterations, full: all tasks)
  /stop             Stop the running agent
  /resume           Resume a previously interrupted session
  /next <task>      Set next task to work on (by number or title)
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
  ralph status      Check on a running or interrupted session
  ralph stop        Stop a background Ralph process gracefully
  ralph list        View all tasks and their completion status
  ralph list --json Output task list as JSON for scripting
  ralph config      View current configuration
  ralph update      Check for and install updates
  ralph -b          Start Ralph in background mode (logs to .ralph/ralph.log)
  ralph resume -b   Resume session in background mode
`);
}

function printVersion(): void {
	console.log(`ralph v${VERSION}`);
}

function formatElapsedTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	const parts: string[] = [];
	if (hours > 0) {
		parts.push(`${hours}h`);
	}
	if (minutes > 0) {
		parts.push(`${minutes}m`);
	}
	parts.push(`${remainingSeconds}s`);

	return parts.join(" ");
}

function formatDuration(milliseconds: number): string {
	if (milliseconds === 0) {
		return "disabled";
	}
	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	const units = ["B", "KB", "MB", "GB"];
	const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
	const value = bytes / 1024 ** unitIndex;
	return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

function printStatus(): void {
	console.log(`◆ ralph v${VERSION} - Status\n`);

	const { running, pid } = isBackgroundProcessRunning();
	const session = loadSession();
	const prd = loadPrd();

	if (running && pid !== null) {
		console.log(`Process Status: Running (PID: ${pid})`);
	} else if (session) {
		console.log(`Process Status: Not running`);
	} else {
		console.log("Process Status: No active session");
	}

	console.log("");

	if (!session) {
		console.log("No session data found.");
		console.log("\nRun 'ralph' or 'ralph -b' to start a new session.");
		return;
	}

	const startDate = new Date(session.startTime);
	const lastUpdateDate = new Date(session.lastUpdateTime);

	console.log("Session Information:");
	console.log(`  Status:           ${session.status}`);
	console.log(`  Started:          ${startDate.toLocaleString()}`);
	console.log(`  Last Update:      ${lastUpdateDate.toLocaleString()}`);
	console.log(`  Elapsed Time:     ${formatElapsedTime(session.elapsedTimeSeconds)}`);
	console.log(`  Iteration:        ${session.currentIteration} / ${session.totalIterations}`);

	console.log("");

	if (prd) {
		const completedTasks = prd.tasks.filter((task) => task.done).length;
		const totalTasks = prd.tasks.length;
		const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

		console.log("Project Progress:");
		console.log(`  Project:          ${prd.project}`);
		console.log(`  Tasks:            ${completedTasks} / ${totalTasks} (${progressPercent}%)`);

		if (session.currentTaskIndex >= 0 && session.currentTaskIndex < prd.tasks.length) {
			const currentTask = prd.tasks[session.currentTaskIndex];
			console.log(`  Current Task:     ${currentTask.title}`);
		} else {
			const nextTask = prd.tasks.find((task) => !task.done);
			if (nextTask) {
				console.log(`  Next Task:        ${nextTask.title}`);
			} else {
				console.log(`  Status:           All tasks complete!`);
			}
		}
	} else {
		console.log("No PRD found in .ralph/prd.json or .ralph/prd.yaml");
	}

	console.log("");

	const recentLogs = getRecentLogEntries(10);
	if (recentLogs.length > 0) {
		console.log("Recent Log Entries:");
		for (const logEntry of recentLogs) {
			console.log(`  ${logEntry}`);
		}
	} else {
		console.log("No log entries found.");
	}

	console.log("");

	if (!running && session.status === "running") {
		console.log("Note: Session appears to have been interrupted.");
		console.log("Use 'ralph resume' to continue from where you left off.");
	}
}

interface TaskListOutput {
	project: string;
	tasks: Array<{
		index: number;
		title: string;
		description: string;
		status: "done" | "pending" | "blocked";
		priority?: "high" | "medium" | "low";
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

function getUnmetDependencies(
	task: { dependsOn?: string[] },
	prd: { tasks: Array<{ title: string; done: boolean }> },
): string[] {
	if (!task.dependsOn || task.dependsOn.length === 0) {
		return [];
	}

	const taskTitleMap = new Map<string, boolean>();
	for (const prdTask of prd.tasks) {
		taskTitleMap.set(prdTask.title.toLowerCase(), prdTask.done);
	}

	return task.dependsOn.filter((depTitle) => {
		const isDone = taskTitleMap.get(depTitle.toLowerCase());
		return isDone !== true;
	});
}

function printList(jsonOutput: boolean): void {
	const prd = loadPrd();

	if (!prd) {
		if (jsonOutput) {
			console.log(JSON.stringify({ error: "No PRD found" }));
		} else {
			console.log("No PRD found in .ralph/prd.json or .ralph/prd.yaml");
			console.log("\nRun 'ralph init' to create a new PRD.");
		}
		return;
	}

	const completedTasks = prd.tasks.filter((task) => task.done).length;
	const blockedTaskCount = prd.tasks.filter(
		(task) => !task.done && getUnmetDependencies(task, prd).length > 0,
	).length;
	const pendingTasks = prd.tasks.length - completedTasks - blockedTaskCount;
	const percentComplete =
		prd.tasks.length > 0 ? Math.round((completedTasks / prd.tasks.length) * 100) : 0;

	if (jsonOutput) {
		const output: TaskListOutput = {
			project: prd.project,
			tasks: prd.tasks.map((task, taskIndex) => {
				const unmetDeps = getUnmetDependencies(task, prd);
				let status: "done" | "pending" | "blocked";
				if (task.done) {
					status = "done";
				} else if (unmetDeps.length > 0) {
					status = "blocked";
				} else {
					status = "pending";
				}
				return {
					index: taskIndex + 1,
					title: task.title,
					description: task.description,
					status,
					priority: task.priority,
					steps: task.steps,
					dependsOn: task.dependsOn,
					blockedBy: unmetDeps.length > 0 ? unmetDeps : undefined,
				};
			}),
			summary: {
				total: prd.tasks.length,
				completed: completedTasks,
				pending: pendingTasks,
				blocked: blockedTaskCount,
				percentComplete,
			},
		};
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	console.log(`◆ ralph v${VERSION} - Task List\n`);
	console.log(`Project: ${prd.project}`);
	console.log(`Progress: ${completedTasks}/${prd.tasks.length} tasks (${percentComplete}%)\n`);

	if (prd.tasks.length === 0) {
		console.log("No tasks defined.");
		console.log("\nRun 'ralph init' to add tasks or use '/add' in the UI.");
		return;
	}

	console.log("Tasks:");
	console.log("─".repeat(70));

	const priorityColors: Record<string, string> = {
		high: "\x1b[31m",
		medium: "\x1b[33m",
		low: "\x1b[90m",
	};
	const priorityIcons: Record<string, string> = {
		high: "↑",
		medium: "→",
		low: "↓",
	};

	for (const [taskIndex, task] of prd.tasks.entries()) {
		const unmetDeps = getUnmetDependencies(task, prd);
		const isBlocked = !task.done && unmetDeps.length > 0;

		let statusIcon: string;
		let statusLabel: string;
		let dimStyle = "";
		const resetStyle = "\x1b[0m";

		if (task.done) {
			statusIcon = "✓";
			statusLabel = "done";
			dimStyle = "\x1b[2m";
		} else if (isBlocked) {
			statusIcon = "⊘";
			statusLabel = "blocked";
			dimStyle = "\x1b[33m";
		} else {
			statusIcon = "○";
			statusLabel = "pending";
		}

		let priorityDisplay = "";
		if (task.priority && !task.done) {
			const priorityColor = priorityColors[task.priority] ?? "";
			const priorityIcon = priorityIcons[task.priority] ?? "";
			priorityDisplay = ` ${priorityColor}[${priorityIcon}${task.priority}]${resetStyle}`;
		}

		console.log(
			`${dimStyle}${statusIcon} [${taskIndex + 1}] ${task.title} (${statusLabel})${resetStyle}${priorityDisplay}`,
		);

		if (task.dependsOn && task.dependsOn.length > 0) {
			const depsDisplay = task.dependsOn
				.map((depTitle) => {
					const depTask = prd.tasks.find(
						(prdTask) => prdTask.title.toLowerCase() === depTitle.toLowerCase(),
					);
					const depIcon = depTask?.done ? "✓" : "○";
					return `${depIcon} ${depTitle}`;
				})
				.join(", ");
			console.log(`   └─ depends on: ${depsDisplay}`);
		}
	}

	console.log("─".repeat(70));

	const summaryParts = [`${completedTasks} completed`];
	if (pendingTasks > 0) {
		summaryParts.push(`${pendingTasks} ready`);
	}
	if (blockedTaskCount > 0) {
		summaryParts.push(`${blockedTaskCount} blocked`);
	}
	console.log(`\nSummary: ${summaryParts.join(", ")}`);

	if (pendingTasks > 0 || blockedTaskCount > 0) {
		const nextTask = prd.tasks.find(
			(task) => !task.done && getUnmetDependencies(task, prd).length === 0,
		);
		if (nextTask) {
			console.log(`\nNext task: ${nextTask.title}`);
		} else if (blockedTaskCount > 0) {
			console.log("\nNo tasks ready - all pending tasks are blocked by dependencies.");
		}
	} else if (completedTasks === prd.tasks.length) {
		console.log("\nAll tasks complete!");
	}
}

function printConfig(jsonOutput: boolean): void {
	const {
		global: globalConfig,
		project: projectConfig,
		effective: effectiveConfig,
	} = getEffectiveConfig();
	const validation = validateConfig(effectiveConfig);

	if (jsonOutput) {
		const output = {
			globalConfigPath: getGlobalConfigPath(),
			projectConfigPath: getProjectConfigPath(),
			globalConfig,
			projectConfig,
			effectiveConfig,
			defaults: CONFIG_DEFAULTS,
			validation: {
				valid: validation.valid,
				errors: validation.errors,
				warnings: validation.warnings,
			},
		};
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	console.log(`◆ ralph v${VERSION} - Configuration\n`);

	if (!validation.valid) {
		console.log("\x1b[31mConfiguration errors found:\x1b[0m");
		console.log(formatValidationErrors(validation));
		console.log("");
	} else if (validation.warnings.length > 0) {
		console.log("\x1b[33mConfiguration warnings:\x1b[0m");
		console.log(formatValidationErrors(validation));
		console.log("");
	}

	console.log("Config Files:");
	console.log(`  Global:  ${getGlobalConfigPath()}`);
	console.log(`  Project: ${getProjectConfigPath()}`);
	console.log("");

	console.log("Effective Configuration:");
	console.log("─".repeat(60));

	console.log("\nAgent Settings:");
	console.log(`  agent:              ${effectiveConfig.agent}`);
	console.log(`  prdFormat:          ${effectiveConfig.prdFormat ?? CONFIG_DEFAULTS.prdFormat}`);

	console.log("\nRetry Settings:");
	console.log(`  maxRetries:         ${effectiveConfig.maxRetries ?? CONFIG_DEFAULTS.maxRetries}`);
	console.log(
		`  retryDelayMs:       ${formatDuration(effectiveConfig.retryDelayMs ?? CONFIG_DEFAULTS.retryDelayMs)}`,
	);

	console.log("\nTimeout Settings:");
	console.log(
		`  agentTimeoutMs:     ${formatDuration(effectiveConfig.agentTimeoutMs ?? CONFIG_DEFAULTS.agentTimeoutMs)}`,
	);
	console.log(
		`  stuckThresholdMs:   ${formatDuration(effectiveConfig.stuckThresholdMs ?? CONFIG_DEFAULTS.stuckThresholdMs)}`,
	);

	console.log("\nLogging:");
	console.log(
		`  logFilePath:        ${effectiveConfig.logFilePath ?? CONFIG_DEFAULTS.logFilePath}`,
	);

	const notifications = effectiveConfig.notifications ?? CONFIG_DEFAULTS.notifications;
	console.log("\nNotifications:");
	console.log(`  systemNotification: ${notifications.systemNotification ?? false}`);
	console.log(`  webhookUrl:         ${notifications.webhookUrl ?? "(not set)"}`);
	console.log(`  markerFilePath:     ${notifications.markerFilePath ?? "(not set)"}`);

	const memory = effectiveConfig.memory ?? CONFIG_DEFAULTS.memory;
	console.log("\nMemory Management:");
	console.log(
		`  maxOutputBuffer:    ${formatBytes(memory.maxOutputBufferBytes ?? CONFIG_DEFAULTS.memory.maxOutputBufferBytes)}`,
	);
	console.log(
		`  memoryWarning:      ${memory.memoryWarningThresholdMb ? `${memory.memoryWarningThresholdMb} MB` : "disabled"}`,
	);
	console.log(
		`  gcHints:            ${(memory.enableGarbageCollectionHints ?? CONFIG_DEFAULTS.memory.enableGarbageCollectionHints) ? "enabled" : "disabled"}`,
	);

	console.log(`\n${"─".repeat(60)}`);

	if (globalConfig && !projectConfig) {
		console.log("\nUsing global configuration only.");
	} else if (projectConfig) {
		console.log("\nProject config overrides global config for:");
		const overrides: string[] = [];
		for (const key of Object.keys(projectConfig)) {
			overrides.push(`  • ${key}`);
		}
		console.log(overrides.join("\n"));
	}

	console.log("\nRun 'ralph setup' to modify global configuration.");
}

async function handleStopCommand(): Promise<void> {
	console.log(`◆ ralph v${VERSION} - Stop\n`);

	const result = await stopDaemonProcess();

	if (result.success && result.pid !== null) {
		const session = loadSession();
		if (session && (session.status === "running" || session.status === "paused")) {
			const updatedSession = updateSessionStatus(session, "stopped");
			saveSession(updatedSession);
			console.log("Session state updated to 'stopped'");
		}
	}

	console.log(result.message);

	if (result.success) {
		console.log("\nUse 'ralph resume' to continue the session later.");
	}

	process.exit(result.success ? 0 : 1);
}

function clearTerminal(): void {
	process.stdout.write("\x1b[2J\x1b[H");
}

interface RunWithSetupProps {
	version: string;
	iterations: number;
	autoResume?: boolean;
	autoStart?: boolean;
	initialTask?: string;
}

function RunWithSetup({
	version,
	iterations,
	autoResume = false,
	autoStart = false,
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
	const { command, iterations, background, json, task } = parseArgs(process.argv);

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
			render(
				<RunWithSetup
					version={VERSION}
					iterations={task ? 1 : iterations}
					autoStart={autoStart}
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
			printStatus();
			break;

		case "list":
			printList(json);
			break;

		case "config":
			printConfig(json);
			break;

		case "stop":
			handleStopCommand().catch((error) => {
				console.error("Failed to stop:", error);
				process.exit(1);
			});
			return;

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
