import type { AgentType } from "@/types.ts";
import { getAgentCommand } from "./config.ts";

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

export { AgentRunner, type AgentRunnerConfig, type AgentRunResult } from "./AgentRunner.ts";
