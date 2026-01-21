import { type ChildProcess, spawn } from "node:child_process";

export interface SleepPreventionService {
	start(): void;
	stop(): void;
	isActive(): boolean;
}

const IS_MACOS = process.platform === "darwin";

let caffeinateProcess: ChildProcess | null = null;

function startCaffeinate(): void {
	if (!IS_MACOS) {
		return;
	}

	if (caffeinateProcess !== null) {
		return;
	}

	try {
		caffeinateProcess = spawn("caffeinate", ["-i"], {
			stdio: "ignore",
			detached: false,
		});

		caffeinateProcess.on("error", () => {
			caffeinateProcess = null;
		});

		caffeinateProcess.on("exit", () => {
			caffeinateProcess = null;
		});
	} catch {
		caffeinateProcess = null;
	}
}

function stopCaffeinate(): void {
	if (caffeinateProcess === null) {
		return;
	}

	try {
		caffeinateProcess.kill("SIGTERM");
	} catch {
		// Process may have already exited
	}

	caffeinateProcess = null;
}

function isCaffeinateActive(): boolean {
	return caffeinateProcess !== null;
}

export function createSleepPreventionService(): SleepPreventionService {
	return {
		start: startCaffeinate,
		stop: stopCaffeinate,
		isActive: isCaffeinateActive,
	};
}
