import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { getLogger } from "./logger.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";

export const PID_FILE_PATH = `${RALPH_DIR}/ralph.pid`;

export function writePidFile(pid: number): void {
	ensureRalphDirExists();
	writeFileSync(PID_FILE_PATH, pid.toString());
}

export function readPidFile(): number | null {
	if (!existsSync(PID_FILE_PATH)) {
		return null;
	}

	try {
		const content = readFileSync(PID_FILE_PATH, "utf-8").trim();
		const pid = Number.parseInt(content, 10);
		return Number.isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

export function deletePidFile(): void {
	if (existsSync(PID_FILE_PATH)) {
		try {
			unlinkSync(PID_FILE_PATH);
		} catch {}
	}
}

export function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export function isBackgroundProcessRunning(): { running: boolean; pid: number | null } {
	const pid = readPidFile();
	if (pid === null) {
		return { running: false, pid: null };
	}

	const running = isProcessRunning(pid);
	if (!running) {
		deletePidFile();
	}

	return { running, pid: running ? pid : null };
}

export interface DaemonOptions {
	args: string[];
	logFilePath?: string;
}

export function spawnDaemonProcess(options: DaemonOptions): number | null {
	const { args, logFilePath } = options;
	const logger = getLogger({ logFilePath });

	const execPath = process.execPath;
	const scriptPath = process.argv[1];

	const argsWithoutBackground = args.filter((arg) => arg !== "--background" && arg !== "-b");

	const spawnArgs = [scriptPath, ...argsWithoutBackground, "--daemon-child"];

	try {
		ensureRalphDirExists();

		const logFile = logFilePath ?? `${RALPH_DIR}/ralph.log`;
		const outFd = openSync(logFile, "a");
		const errFd = openSync(logFile, "a");

		const childProcess: ChildProcess = spawn(execPath, spawnArgs, {
			detached: true,
			stdio: ["ignore", outFd, errFd],
			env: {
				...process.env,
				RALPH_DAEMON: "true",
			},
		});

		const pid = childProcess.pid;
		if (pid === undefined) {
			logger.error("Failed to spawn daemon process: no PID returned");
			return null;
		}

		childProcess.unref();

		writePidFile(pid);
		logger.info("Daemon process started", { pid, logFile });

		return pid;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Failed to spawn daemon process", { error: errorMessage });
		return null;
	}
}

export function isDaemonProcess(): boolean {
	return process.env.RALPH_DAEMON === "true" || process.argv.includes("--daemon-child");
}

export function cleanupDaemon(): void {
	deletePidFile();
}
