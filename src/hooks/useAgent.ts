import type { Subprocess } from "bun";
import { useCallback, useRef, useState } from "react";
import { getAgentCommand, loadConfig } from "../lib/config.ts";
import { buildPrompt, COMPLETION_MARKER } from "../lib/prompt.ts";

interface UseAgentState {
	output: string;
	isStreaming: boolean;
	isComplete: boolean;
	exitCode: number | null;
	error: string | null;
}

interface UseAgentReturn extends UseAgentState {
	start: () => Promise<void>;
	stop: () => void;
	reset: () => void;
}

const INITIAL_STATE: UseAgentState = {
	output: "",
	isStreaming: false,
	isComplete: false,
	exitCode: null,
	error: null,
};

export function useAgent(): UseAgentReturn {
	const [state, setState] = useState<UseAgentState>(INITIAL_STATE);
	const processRef = useRef<Subprocess | null>(null);
	const abortedRef = useRef(false);

	const start = useCallback(async () => {
		abortedRef.current = false;
		setState({
			...INITIAL_STATE,
			isStreaming: true,
		});

		try {
			const prompt = buildPrompt();
			const config = loadConfig();
			const baseCommand = getAgentCommand(config.agent);

			const agentProcess = Bun.spawn([...baseCommand, prompt], {
				stdout: "pipe",
				stderr: "pipe",
			});

			processRef.current = agentProcess;

			const stdoutReader = agentProcess.stdout.getReader();
			const decoder = new TextDecoder();
			let fullOutput = "";

			while (!abortedRef.current) {
				const { done, value } = await stdoutReader.read();
				if (done) break;

				const text = decoder.decode(value);
				fullOutput += text;

				setState((prev) => ({
					...prev,
					output: fullOutput,
				}));
			}

			const exitCode = await agentProcess.exited;
			const isComplete = fullOutput.includes(COMPLETION_MARKER);

			setState((prev) => ({
				...prev,
				isStreaming: false,
				isComplete,
				exitCode,
			}));
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			setState((prev) => ({
				...prev,
				isStreaming: false,
				error: errorMessage,
			}));
		} finally {
			processRef.current = null;
		}
	}, []);

	const stop = useCallback(() => {
		abortedRef.current = true;
		if (processRef.current) {
			processRef.current.kill();
			processRef.current = null;
		}
		setState((prev) => ({
			...prev,
			isStreaming: false,
		}));
	}, []);

	const reset = useCallback(() => {
		stop();
		setState(INITIAL_STATE);
	}, [stop]);

	return {
		...state,
		start,
		stop,
		reset,
	};
}
