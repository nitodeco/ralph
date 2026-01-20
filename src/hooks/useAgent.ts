import type { Subprocess } from "bun";
import { useCallback, useRef, useState } from "react";
import { getAgentCommand, loadConfig } from "../lib/config.ts";
import { getLogger } from "../lib/logger.ts";
import { buildPrompt, COMPLETION_MARKER } from "../lib/prompt.ts";

interface UseAgentState {
	output: string;
	isStreaming: boolean;
	isComplete: boolean;
	exitCode: number | null;
	error: string | null;
	retryCount: number;
	isRetrying: boolean;
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
	retryCount: 0,
	isRetrying: false,
};

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
	if (!line.trim()) return null;

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

type ErrorCategory = "retryable" | "fatal";

interface CategorizedError {
	category: ErrorCategory;
	message: string;
}

const FATAL_ERROR_PATTERNS = [
	/permission denied/i,
	/command not found/i,
	/ENOENT/i,
	/invalid api key/i,
	/authentication failed/i,
	/unauthorized/i,
	/access denied/i,
];

function categorizeError(error: string, exitCode: number | null): CategorizedError {
	for (const pattern of FATAL_ERROR_PATTERNS) {
		if (pattern.test(error)) {
			return { category: "fatal", message: error };
		}
	}

	if (exitCode === 1) {
		return { category: "retryable", message: error };
	}

	if (exitCode === 127) {
		return { category: "fatal", message: "Agent command not found" };
	}

	if (exitCode === 126) {
		return { category: "fatal", message: "Agent command not executable" };
	}

	return { category: "retryable", message: error };
}

function calculateRetryDelay(baseDelayMs: number, retryCount: number): number {
	return baseDelayMs * 2 ** retryCount;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAgent(): UseAgentReturn {
	const [state, setState] = useState<UseAgentState>(INITIAL_STATE);
	const processRef = useRef<Subprocess | null>(null);
	const abortedRef = useRef(false);
	const retryCountRef = useRef(0);

	const runAgent = useCallback(async (): Promise<{
		success: boolean;
		exitCode: number | null;
		output: string;
		isComplete: boolean;
		error?: string;
	}> => {
		const prompt = buildPrompt();
		const config = loadConfig();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const baseCommand = getAgentCommand(config.agent);

		logger.logAgentStart(config.agent, prompt);

		const agentProcess = Bun.spawn([...baseCommand, prompt], {
			stdin: null,
			stdout: "pipe",
			stderr: "pipe",
		});

		processRef.current = agentProcess;

		const stdoutReader = agentProcess.stdout.getReader();
		const stderrReader = agentProcess.stderr.getReader();
		const decoder = new TextDecoder();
		let rawOutput = "";
		let parsedOutput = "";
		let stderrOutput = "";
		let lineBuffer = "";
		let lastParsedText = "";

		const readStdout = async () => {
			while (!abortedRef.current) {
				const { done, value } = await stdoutReader.read();
				if (done) break;

				const text = decoder.decode(value);
				rawOutput += text;
				lineBuffer += text;

				const lines = lineBuffer.split("\n");
				lineBuffer = lines.pop() ?? "";

				for (const line of lines) {
					const parsedText = parseStreamJsonLine(line);
					if (parsedText && parsedText !== lastParsedText) {
						lastParsedText = parsedText;
						parsedOutput = parsedText;
						setState((prev) => ({
							...prev,
							output: parsedOutput,
						}));
					}
				}
			}
		};

		const readStderr = async () => {
			while (!abortedRef.current) {
				const { done, value } = await stderrReader.read();
				if (done) break;
				stderrOutput += decoder.decode(value);
			}
		};

		await Promise.all([readStdout(), readStderr()]);

		const exitCode = await agentProcess.exited;
		const isComplete = rawOutput.includes(COMPLETION_MARKER);

		if (exitCode !== 0 && !isComplete) {
			const errorMessage = stderrOutput || `Agent exited with code ${exitCode}`;
			logger.logAgentError(errorMessage, exitCode);
			return { success: false, exitCode, output: parsedOutput, isComplete, error: errorMessage };
		}

		logger.logAgentComplete(exitCode, isComplete);
		return { success: true, exitCode, output: parsedOutput, isComplete };
	}, []);

	const start = useCallback(async () => {
		abortedRef.current = false;
		retryCountRef.current = 0;

		setState({
			...INITIAL_STATE,
			isStreaming: true,
		});

		const config = loadConfig();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const maxRetries = config.maxRetries ?? 3;
		const retryDelayMs = config.retryDelayMs ?? 5000;

		try {
			while (retryCountRef.current <= maxRetries && !abortedRef.current) {
				const result = await runAgent();

				if (result.success || abortedRef.current) {
					setState((prev) => ({
						...prev,
						isStreaming: false,
						isComplete: result.isComplete,
						exitCode: result.exitCode,
						retryCount: retryCountRef.current,
					}));
					break;
				}

				const categorizedError = categorizeError(result.error ?? "", result.exitCode);

				if (categorizedError.category === "fatal") {
					logger.error("Fatal error encountered, not retrying", {
						error: categorizedError.message,
						exitCode: result.exitCode,
					});
					setState((prev) => ({
						...prev,
						isStreaming: false,
						error: `Fatal error: ${categorizedError.message}`,
						exitCode: result.exitCode,
						retryCount: retryCountRef.current,
					}));
					break;
				}

				if (retryCountRef.current < maxRetries) {
					retryCountRef.current += 1;
					const delay = calculateRetryDelay(retryDelayMs, retryCountRef.current - 1);

					logger.logAgentRetry(retryCountRef.current, maxRetries, delay);

					setState((prev) => ({
						...prev,
						isRetrying: true,
						retryCount: retryCountRef.current,
						output: "",
					}));

					await sleep(delay);

					if (abortedRef.current) break;

					setState((prev) => ({
						...prev,
						isRetrying: false,
					}));
				} else {
					logger.error("Max retries exceeded", {
						maxRetries,
						lastError: categorizedError.message,
						exitCode: result.exitCode,
					});
					setState((prev) => ({
						...prev,
						isStreaming: false,
						error: `Max retries (${maxRetries}) exceeded. Last error: ${categorizedError.message}`,
						exitCode: result.exitCode,
						retryCount: retryCountRef.current,
					}));
					break;
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Unexpected error during agent execution", { error: errorMessage });
			setState((prev) => ({
				...prev,
				isStreaming: false,
				error: errorMessage,
				retryCount: retryCountRef.current,
			}));
		} finally {
			processRef.current = null;
		}
	}, [runAgent]);

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
