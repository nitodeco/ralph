import { isStreamJsonMessage } from "@/lib/type-guards.ts";

export interface StreamJsonMessage {
	type: string;
	subtype?: string;
	text?: string;
	message?: {
		role: string;
		content: Array<{ type: string; text?: string }>;
	};
	result?: string;
}

export function parseStreamJsonLine(line: string): string | null {
	if (!line.trim()) {
		return null;
	}

	try {
		const parsed: unknown = JSON.parse(line);

		if (!isStreamJsonMessage(parsed)) {
			return line;
		}

		if (parsed.type === "assistant" && parsed.message?.content) {
			const textContent = parsed.message.content.find((content) => content.type === "text");

			if (textContent?.text) {
				return textContent.text;
			}
		}

		if (parsed.type === "result" && parsed.subtype === "success" && parsed.result) {
			return parsed.result;
		}

		return null;
	} catch {
		return line;
	}
}
