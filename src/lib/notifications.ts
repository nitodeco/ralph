import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { platform } from "node:os";
import { match } from "ts-pattern";
import type { NotificationConfig, NotificationEvent } from "@/types.ts";

interface NotificationPayload {
	event: NotificationEvent;
	project?: string;
	message: string;
	timestamp: string;
	details?: Record<string, unknown>;
}

function getEventTitle(event: NotificationEvent): string {
	return match(event)
		.with("complete", () => "Ralph - All Tasks Complete")
		.with("max_iterations", () => "Ralph - Max Iterations Reached")
		.with("fatal_error", () => "Ralph - Fatal Error")
		.with("input_required", () => "Ralph - Input Required")
		.with("session_paused", () => "Ralph - Session Paused")
		.with("verification_failed", () => "Ralph - Verification Failed")
		.exhaustive();
}

function getEventMessage(event: NotificationEvent, projectName?: string): string {
	const projectPrefix = projectName ? `[${projectName}] ` : "";

	return match(event)
		.with("complete", () => `${projectPrefix}All tasks have been completed successfully!`)
		.with(
			"max_iterations",
			() => `${projectPrefix}Maximum iterations reached. PRD is not yet complete.`,
		)
		.with("fatal_error", () => `${projectPrefix}A fatal error occurred. Check logs for details.`)
		.with("input_required", () => `${projectPrefix}Waiting for your input to continue.`)
		.with(
			"session_paused",
			() => `${projectPrefix}Session has been paused. Use /resume to continue.`,
		)
		.with(
			"verification_failed",
			() => `${projectPrefix}Verification failed. Review required before continuing.`,
		)
		.exhaustive();
}

export async function sendSystemNotification(
	event: NotificationEvent,
	projectName?: string,
): Promise<boolean> {
	const currentPlatform = platform();

	if (currentPlatform !== "darwin") {
		return false;
	}

	const title = getEventTitle(event);
	const message = getEventMessage(event, projectName);

	try {
		const escapedTitle = title.replace(/"/g, '\\"');
		const escapedMessage = message.replace(/"/g, '\\"');
		const script = `display notification "${escapedMessage}" with title "${escapedTitle}"`;

		execSync(`osascript -e '${script}'`, { stdio: "ignore" });

		return true;
	} catch {
		return false;
	}
}

export async function sendWebhookNotification(
	webhookUrl: string,
	event: NotificationEvent,
	projectName?: string,
	details?: Record<string, unknown>,
): Promise<boolean> {
	const payload: NotificationPayload = {
		event,
		project: projectName,
		message: getEventMessage(event, projectName),
		timestamp: new Date().toISOString(),
		details,
	};

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		return response.ok;
	} catch {
		return false;
	}
}

export function writeMarkerFile(
	markerFilePath: string,
	event: NotificationEvent,
	projectName?: string,
	details?: Record<string, unknown>,
): boolean {
	const payload: NotificationPayload = {
		event,
		project: projectName,
		message: getEventMessage(event, projectName),
		timestamp: new Date().toISOString(),
		details,
	};

	try {
		writeFileSync(markerFilePath, JSON.stringify(payload, null, 2));

		return true;
	} catch {
		return false;
	}
}

export async function sendNotifications(
	config: NotificationConfig | undefined,
	event: NotificationEvent,
	projectName?: string,
	details?: Record<string, unknown>,
): Promise<void> {
	if (!config) {
		return;
	}

	const notificationPromises: Promise<boolean>[] = [];

	if (config.systemNotification) {
		notificationPromises.push(sendSystemNotification(event, projectName));
	}

	if (config.webhookUrl) {
		notificationPromises.push(
			sendWebhookNotification(config.webhookUrl, event, projectName, details),
		);
	}

	if (config.markerFilePath) {
		notificationPromises.push(
			Promise.resolve(writeMarkerFile(config.markerFilePath, event, projectName, details)),
		);
	}

	await Promise.all(notificationPromises);
}
