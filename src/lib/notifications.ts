import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { platform } from "node:os";
import type { NotificationConfig, NotificationEvent } from "@/types.ts";

interface NotificationPayload {
	event: NotificationEvent;
	project?: string;
	message: string;
	timestamp: string;
	details?: Record<string, unknown>;
}

function getEventTitle(event: NotificationEvent): string {
	switch (event) {
		case "complete":
			return "Ralph - All Tasks Complete";
		case "max_iterations":
			return "Ralph - Max Iterations Reached";
		case "fatal_error":
			return "Ralph - Fatal Error";
	}
}

function getEventMessage(event: NotificationEvent, projectName?: string): string {
	const projectPrefix = projectName ? `[${projectName}] ` : "";

	switch (event) {
		case "complete":
			return `${projectPrefix}All tasks have been completed successfully!`;
		case "max_iterations":
			return `${projectPrefix}Maximum iterations reached. PRD is not yet complete.`;
		case "fatal_error":
			return `${projectPrefix}A fatal error occurred. Check logs for details.`;
	}
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
