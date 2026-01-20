import { isBackgroundProcessRunning } from "@/lib/daemon.ts";
import { createError, ErrorCode, formatError } from "@/lib/errors.ts";
import { getRecentLogEntries } from "@/lib/logger.ts";
import { loadPrd } from "@/lib/prd.ts";
import { loadSession } from "@/lib/session.ts";
import { formatElapsedTime } from "../formatters.ts";

export function printStatus(version: string, verbose = false): void {
	console.log(`◆ ralph v${version} - Status\n`);

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
		const error = createError(ErrorCode.SESSION_NOT_FOUND, "No session data found");

		console.log(formatError(error, verbose));

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

		const currentTask = prd.tasks[session.currentTaskIndex];

		if (
			session.currentTaskIndex >= 0 &&
			session.currentTaskIndex < prd.tasks.length &&
			currentTask
		) {
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
		const prdError = createError(ErrorCode.PRD_NOT_FOUND, "No PRD found in .ralph/prd.json");

		console.log(formatError(prdError, verbose));
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
