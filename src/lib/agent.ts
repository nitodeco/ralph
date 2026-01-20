import type { AgentResult, AgentType } from "../types.ts";
import { getAgentCommand, loadConfig } from "./config.ts";
import { loadInstructions } from "./prd.ts";
import { buildPrompt, COMPLETION_MARKER } from "./prompt.ts";

export async function runAgent(): Promise<AgentResult> {
	const instructions = loadInstructions();
	const prompt = buildPrompt({ instructions });
	const config = loadConfig();
	const baseCommand = getAgentCommand(config.agent);

	const process = Bun.spawn([...baseCommand, prompt], {
		stdin: null,
		stdout: "pipe",
		stderr: "pipe",
	});

	const outputChunks: string[] = [];

	const stdoutReader = process.stdout.getReader();
	const decoder = new TextDecoder();

	while (true) {
		const { done, value } = await stdoutReader.read();
		if (done) break;

		const text = decoder.decode(value);
		outputChunks.push(text);
		Bun.write(Bun.stdout, text);
	}

	const exitCode = await process.exited;
	const output = outputChunks.join("");
	const isComplete = output.includes(COMPLETION_MARKER);

	return {
		output,
		isComplete,
		exitCode,
	};
}

export interface RunAgentWithPromptOptions {
	prompt: string;
	agentType: AgentType;
	onOutput?: (chunk: string) => void;
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

	const outputChunks: string[] = [];
	const stdoutReader = agentProcess.stdout.getReader();
	const decoder = new TextDecoder();

	while (true) {
		const { done, value } = await stdoutReader.read();
		if (done) break;

		const text = decoder.decode(value);
		outputChunks.push(text);

		if (onOutput) {
			onOutput(text);
		}
	}

	await agentProcess.exited;
	return outputChunks.join("");
}
