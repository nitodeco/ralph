import { stopDaemonProcess } from "@/lib/daemon.ts";
import { getSessionService } from "@/lib/services/index.ts";

export async function handleStopCommand(version: string): Promise<void> {
	console.log(`◆ ralph v${version} - Stop\n`);

	const stopResult = await stopDaemonProcess();

	if (stopResult.success && stopResult.pid !== null) {
		const sessionService = getSessionService();
		const session = sessionService.load();

		if (session && (session.status === "running" || session.status === "paused")) {
			const updatedSession = sessionService.updateStatus(session, "stopped");

			sessionService.save(updatedSession);
			console.log("Session state updated to 'stopped'");
		}
	}

	console.log(stopResult.message);

	if (stopResult.success) {
		console.log("\nUse 'ralph resume' to continue the session later.");
	}

	process.exit(stopResult.success ? 0 : 1);
}
