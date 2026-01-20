export function formatElapsedTime(seconds: number): string {
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

export function formatDuration(milliseconds: number): string {
	if (milliseconds === 0) {
		return "disabled";
	}
	const seconds = milliseconds / 1000;
	if (seconds < 60) {
		return `${seconds}s`;
	}
	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes}m`;
	}
	const hours = minutes / 60;
	return `${hours}h`;
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	}
	const kilobytes = bytes / 1024;
	if (kilobytes < 1024) {
		return `${kilobytes.toFixed(1)}KB`;
	}
	const megabytes = kilobytes / 1024;
	return `${megabytes.toFixed(1)}MB`;
}

export function formatConfigValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "\x1b[2mnot set\x1b[0m";
	}
	if (typeof value === "boolean") {
		return value ? "\x1b[32mtrue\x1b[0m" : "\x1b[31mfalse\x1b[0m";
	}
	if (typeof value === "number") {
		return `\x1b[33m${value}\x1b[0m`;
	}
	return `\x1b[36m${value}\x1b[0m`;
}
