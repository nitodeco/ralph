import type { AgentResult } from "../types.ts";
import { buildPrompt, COMPLETION_MARKER } from "./prompt.ts";

export async function runAgent(): Promise<AgentResult> {
	const prompt = buildPrompt();

	const process = Bun.spawn(["agent", "-p", "--force", prompt], {
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
