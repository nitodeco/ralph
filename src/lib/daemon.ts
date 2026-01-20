import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { getLogger } from "./logger.ts";
import { ensureRalphDirExists, RALPH_DIR } from "./prd.ts";
import { loadSession, saveSession, updateSessionStatus } from "./session.ts";

export type ShutdownSignal = "SIGTERM" | "SIGINT" | "SIGHUP";

interface ShutdownHandler {
	onShutdown: () => void;
}

let shutdownHandlerRef: ShutdownHandler | null = null;
let shutdownInProgress = false;

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

	if (!scriptPath) {
		return null;
	}

	const argsWithoutBackground = args.filter((arg) => arg !== "--background" && arg !== "-b");

	const spawnArgs: string[] = [scriptPath, ...argsWithoutBackground, "--daemon-child"];

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

export interface StopResult {
	success: boolean;
	pid: number | null;
	message: string;
	wasKilled: boolean;
}

export async function stopDaemonProcess(timeoutMs = 5000): Promise<StopResult> {
	const { running, pid } = isBackgroundProcessRunning();

	if (!running || pid === null) {
		return {
			success: false,
			pid: null,
			message: "No Ralph process is currently running",
			wasKilled: false,
		};
	}

	const logger = getLogger({});

	try {
		process.kill(pid, "SIGTERM");
		logger.info("Sent SIGTERM to daemon process", { pid });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Failed to send SIGTERM", { pid, error: errorMessage });
		deletePidFile();
		return {
			success: false,
			pid,
			message: `Failed to send stop signal: ${errorMessage}`,
			wasKilled: false,
		};
	}

	const pollIntervalMs = 100;
	const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
	let attempts = 0;

	while (attempts < maxAttempts) {
		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
		attempts++;

		if (!isProcessRunning(pid)) {
			logger.info("Daemon process stopped gracefully", { pid });
			deletePidFile();
			return {
				success: true,
				pid,
				message: `Ralph process (PID: ${pid}) stopped gracefully`,
				wasKilled: false,
			};
		}
	}

	logger.warn("Process did not exit after SIGTERM, sending SIGKILL", { pid, timeoutMs });

	try {
		process.kill(pid, "SIGKILL");
		logger.info("Sent SIGKILL to daemon process", { pid });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error("Failed to send SIGKILL", { pid, error: errorMessage });
	}

	await new Promise((resolve) => setTimeout(resolve, 500));

	if (!isProcessRunning(pid)) {
		deletePidFile();
		return {
			success: true,
			pid,
			message: `Ralph process (PID: ${pid}) was forcefully terminated`,
			wasKilled: true,
		};
	}

	return {
		success: false,
		pid,
		message: `Failed to stop Ralph process (PID: ${pid})`,
		wasKilled: false,
	};
}

export function setShutdownHandler(handler: ShutdownHandler): void {
	shutdownHandlerRef = handler;
}

export function clearShutdownHandler(): void {
	shutdownHandlerRef = null;
}

function handleShutdownSignal(signal: ShutdownSignal): void {
	if (shutdownInProgress) {
		return;
	}
	shutdownInProgress = true;

	const logger = getLogger({});
	logger.info("Shutdown signal received", { signal });

	const session = loadSession();
	if (session && (session.status === "running" || session.status === "paused")) {
		const updatedSession = updateSessionStatus(session, "stopped");
		saveSession(updatedSession);
		logger.info("Session state saved as stopped", { signal });
	}

	if (shutdownHandlerRef) {
		try {
			shutdownHandlerRef.onShutdown();
			logger.info("Agent process terminated", { signal });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Error during shutdown handler", { signal, error: errorMessage });
		}
	}

	deletePidFile();
	logger.info("Shutdown complete", { signal });

	process.exit(0);
}

export function setupSignalHandlers(): void {
	const signals: ShutdownSignal[] = ["SIGTERM", "SIGINT", "SIGHUP"];

	for (const signal of signals) {
		process.on(signal, () => handleShutdownSignal(signal));
	}

	process.on("exit", () => {
		if (!shutdownInProgress) {
			const logger = getLogger({});
			logger.info("Process exiting");
			deletePidFile();
		}
	});
}
