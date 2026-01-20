import type { AgentType } from "@/types.ts";
import { getAgentCommand } from "./config.ts";

export interface RunAgentWithPromptOptions {
	prompt: string;
	agentType: AgentType;
	onOutput?: (chunk: string) => void;
}

interface StreamJsonMessage {
	type: string;
	subtype?: string;
	text?: string;
	message?: {
		role: string;
		content: Array<{ type: string; text?: string }>;
	};
	result?: string;
}

function parseStreamJsonLine(line: string): string | null {
	if (!line.trim()) {
		return null;
	}

	try {
		const parsed = JSON.parse(line) as StreamJsonMessage;

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

export async function runAgentWithPrompt({
	prompt,
	agentType,
	onOutput,
}: RunAgentWithPromptOptions): Promise<string> {
	const baseCommand = getAgentCommand(agentType);

	const agentProcess = Bun.spawn([...baseCommand, prompt], {
		stdin: null,
		stdout: "pipe",
		stderr: "pipe",
	});

	const parsedOutputChunks: string[] = [];
	const stdoutReader = agentProcess.stdout.getReader();
	const decoder = new TextDecoder();
	let lineBuffer = "";

	while (true) {
		const { done, value } = await stdoutReader.read();

		if (done) {
			break;
		}

		const text = decoder.decode(value);

		lineBuffer += text;

		const lines = lineBuffer.split("\n");

		lineBuffer = lines.pop() ?? "";

		for (const line of lines) {
			const parsedText = parseStreamJsonLine(line);

			if (parsedText) {
				parsedOutputChunks.push(parsedText);

				if (onOutput) {
					onOutput(parsedText);
				}
			}
		}
	}

	if (lineBuffer) {
		const parsedText = parseStreamJsonLine(lineBuffer);

		if (parsedText) {
			parsedOutputChunks.push(parsedText);

			if (onOutput) {
				onOutput(parsedText);
			}
		}
	}

	await agentProcess.exited;

	return parsedOutputChunks.join("");
}

export { AgentRunner, type AgentRunnerConfig, type AgentRunResult } from "./AgentRunner.ts";
