import { existsSync, readFileSync } from "node:fs";
import { writeFileIdempotent } from "@/lib/idempotency.ts";
import { ensureProjectDirExists, getCommandHistoryFilePath } from "@/lib/paths.ts";

const MAX_HISTORY_SIZE = 100;

export interface CommandHistory {
	commands: string[];
	lastUpdated: string;
}

function isCommandHistory(value: unknown): value is CommandHistory {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const obj = value as Record<string, unknown>;

	return (
		Array.isArray(obj.commands) &&
		obj.commands.every((item) => typeof item === "string") &&
		typeof obj.lastUpdated === "string"
	);
}

function createEmptyHistory(): CommandHistory {
	return {
		commands: [],
		lastUpdated: new Date().toISOString(),
	};
}

export function loadCommandHistory(): CommandHistory {
	const filePath = getCommandHistoryFilePath();

	if (!existsSync(filePath)) {
		return createEmptyHistory();
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		const parsed: unknown = JSON.parse(content);

		if (!isCommandHistory(parsed)) {
			return createEmptyHistory();
		}

		return parsed;
	} catch {
		return createEmptyHistory();
	}
}

export function saveCommandHistory(history: CommandHistory): void {
	ensureProjectDirExists();
	history.lastUpdated = new Date().toISOString();
	writeFileIdempotent(getCommandHistoryFilePath(), JSON.stringify(history, null, "\t"));
}

export function addCommandToHistory(command: string): void {
	const history = loadCommandHistory();
	const lastCommand = history.commands.at(-1);

	if (lastCommand === command) {
		return;
	}

	history.commands.push(command);

	if (history.commands.length > MAX_HISTORY_SIZE) {
		history.commands = history.commands.slice(-MAX_HISTORY_SIZE);
	}

	saveCommandHistory(history);
}

export function getCommandHistoryList(): string[] {
	return loadCommandHistory().commands;
}

export function clearCommandHistory(): void {
	saveCommandHistory(createEmptyHistory());
}
