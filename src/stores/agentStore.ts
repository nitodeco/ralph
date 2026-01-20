import type { Subprocess } from "bun";
import { create } from "zustand";
import { getAgentCommand, loadConfig } from "@/lib/config.ts";
import { clearShutdownHandler, setShutdownHandler } from "@/lib/daemon.ts";
import { DEFAULTS } from "@/lib/defaults.ts";
import { getLogger } from "@/lib/logger.ts";
import { getMaxOutputBytes, truncateOutputBuffer } from "@/lib/memory.ts";
import { loadInstructions } from "@/lib/prd.ts";
import { logError as logProgressError, logRetry as logProgressRetry } from "@/lib/progress.ts";
import { buildPrompt, COMPLETION_MARKER } from "@/lib/prompt.ts";
import { useAppStore } from "./appStore.ts";
import { useIterationStore } from "./iterationStore.ts";

interface AgentState {
	output: string;
	isStreaming: boolean;
	isComplete: boolean;
	exitCode: number | null;
	error: string | null;
	retryCount: number;
	isRetrying: boolean;
}

interface AgentActions {
	start: () => Promise<void>;
	stop: () => void;
	reset: () => void;
	setOutput: (output: string) => void;
	clearOutput: () => void;
}

type AgentStore = AgentState & AgentActions;

const INITIAL_STATE: AgentState = {
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

let processRef: Subprocess | null = null;
let abortedRef = false;
let retryCountRef = 0;

interface RunAgentOptions {
	setOutput: (output: string) => void;
	specificTask?: string | null;
}

async function runAgentInternal(options: RunAgentOptions): Promise<{
	success: boolean;
	exitCode: number | null;
	output: string;
	isComplete: boolean;
	error?: string;
}> {
	const { setOutput, specificTask } = options;
	const instructions = loadInstructions();
	const prompt = buildPrompt({ instructions, specificTask });
	const config = loadConfig();
	const logger = getLogger({ logFilePath: config.logFilePath });
	const baseCommand = getAgentCommand(config.agent);
	const agentTimeoutMs = config.agentTimeoutMs ?? DEFAULTS.agentTimeoutMs;
	const stuckThresholdMs = config.stuckThresholdMs ?? DEFAULTS.stuckThresholdMs;

	logger.logAgentStart(config.agent, prompt);

	const agentProcess = Bun.spawn([...baseCommand, prompt], {
		stdin: null,
		stdout: "pipe",
		stderr: "pipe",
	});

	processRef = agentProcess;

	const stdoutReader = agentProcess.stdout.getReader();
	const stderrReader = agentProcess.stderr.getReader();
	const decoder = new TextDecoder();
	let rawOutput = "";
	let parsedOutput = "";
	let stderrOutput = "";
	let lineBuffer = "";
	let lastParsedText = "";

	let lastActivityTime = Date.now();
	let timeoutTriggered = false;
	let stuckTriggered = false;

	const updateLastActivity = () => {
		lastActivityTime = Date.now();
	};

	const processStartTime = Date.now();

	const timeoutTimer =
		agentTimeoutMs > 0
			? setTimeout(() => {
					timeoutTriggered = true;
					logger.warn("Agent timeout exceeded, killing process", {
						timeoutMs: agentTimeoutMs,
						elapsedMs: Date.now() - processStartTime,
					});
					if (processRef) {
						processRef.kill();
					}
				}, agentTimeoutMs)
			: null;

	const stuckCheckInterval =
		stuckThresholdMs > 0
			? setInterval(
					() => {
						const timeSinceLastActivity = Date.now() - lastActivityTime;
						if (timeSinceLastActivity >= stuckThresholdMs) {
							stuckTriggered = true;
							logger.warn("Agent appears stuck (no output), killing process", {
								stuckThresholdMs,
								timeSinceLastActivityMs: timeSinceLastActivity,
							});
							if (processRef) {
								processRef.kill();
							}
						}
					},
					Math.min(stuckThresholdMs / 4, 30000),
				)
			: null;

	const readStdout = async () => {
		while (!abortedRef) {
			const { done, value } = await stdoutReader.read();
			if (done) break;

			updateLastActivity();
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
					setOutput(parsedOutput);
				}
			}
		}
	};

	const readStderr = async () => {
		while (!abortedRef) {
			const { done, value } = await stderrReader.read();
			if (done) break;
			updateLastActivity();
			stderrOutput += decoder.decode(value);
		}
	};

	try {
		await Promise.all([readStdout(), readStderr()]);
	} finally {
		if (timeoutTimer) clearTimeout(timeoutTimer);
		if (stuckCheckInterval) clearInterval(stuckCheckInterval);
	}

	const exitCode = await agentProcess.exited;
	const isComplete = rawOutput.includes(COMPLETION_MARKER);

	if (timeoutTriggered) {
		const errorMessage = `Agent timed out after ${Math.round(agentTimeoutMs / 1000 / 60)} minutes`;
		logger.logAgentError(errorMessage, exitCode);
		return {
			success: false,
			exitCode,
			output: parsedOutput,
			isComplete: false,
			error: errorMessage,
		};
	}

	if (stuckTriggered) {
		const errorMessage = `Agent stuck (no output for ${Math.round(stuckThresholdMs / 1000 / 60)} minutes)`;
		logger.logAgentError(errorMessage, exitCode);
		return {
			success: false,
			exitCode,
			output: parsedOutput,
			isComplete: false,
			error: errorMessage,
		};
	}

	if (exitCode !== 0 && !isComplete) {
		const errorMessage = stderrOutput || `Agent exited with code ${exitCode}`;
		logger.logAgentError(errorMessage, exitCode);
		return { success: false, exitCode, output: parsedOutput, isComplete, error: errorMessage };
	}

	logger.logAgentComplete(exitCode, isComplete);
	return { success: true, exitCode, output: parsedOutput, isComplete };
}

export const useAgentStore = create<AgentStore>((set, get) => ({
	...INITIAL_STATE,

	setOutput: (output: string) => {
		const config = loadConfig();
		const maxBytes = getMaxOutputBytes(config.maxOutputHistoryBytes);
		const truncatedOutput = truncateOutputBuffer(output, maxBytes);
		set({ output: truncatedOutput });
	},

	start: async () => {
		abortedRef = false;
		retryCountRef = 0;

		setShutdownHandler({
			onShutdown: () => {
				abortedRef = true;
				if (processRef) {
					processRef.kill();
					processRef = null;
				}
			},
		});

		set({
			...INITIAL_STATE,
			isStreaming: true,
		});

		const config = loadConfig();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const maxRetries = config.maxRetries ?? 3;
		const retryDelayMs = config.retryDelayMs ?? 5000;

		const appStore = useAppStore.getState();
		const specificTask = appStore.getEffectiveNextTask();
		if (specificTask && appStore.manualNextTask) {
			appStore.clearManualNextTask();
		}

		try {
			while (retryCountRef <= maxRetries && !abortedRef) {
				const result = await runAgentInternal({ setOutput: get().setOutput, specificTask });

				if (result.success || abortedRef) {
					set({
						isStreaming: false,
						isComplete: result.isComplete,
						exitCode: result.exitCode,
						retryCount: retryCountRef,
					});
					break;
				}

				const categorizedError = categorizeError(result.error ?? "", result.exitCode);

				if (categorizedError.category === "fatal") {
					logger.error("Fatal error encountered, not retrying", {
						error: categorizedError.message,
						exitCode: result.exitCode,
					});
					const iterationState = useIterationStore.getState();
					logProgressError(
						iterationState.current,
						iterationState.total,
						`Fatal error: ${categorizedError.message}`,
						{ exitCode: result.exitCode, fatal: true },
					);
					set({
						isStreaming: false,
						error: `Fatal error: ${categorizedError.message}`,
						exitCode: result.exitCode,
						retryCount: retryCountRef,
					});
					break;
				}

				if (retryCountRef < maxRetries) {
					retryCountRef += 1;
					const delay = calculateRetryDelay(retryDelayMs, retryCountRef - 1);

					logger.logAgentRetry(retryCountRef, maxRetries, delay);
					const iterationState = useIterationStore.getState();
					logProgressRetry(
						iterationState.current,
						iterationState.total,
						retryCountRef,
						maxRetries,
						delay,
						categorizedError.message,
					);

					set({
						isRetrying: true,
						retryCount: retryCountRef,
						output: "",
					});

					await sleep(delay);

					if (abortedRef) break;

					set({
						isRetrying: false,
					});
				} else {
					logger.error("Max retries exceeded", {
						maxRetries,
						lastError: categorizedError.message,
						exitCode: result.exitCode,
					});
					const iterationState = useIterationStore.getState();
					logProgressError(
						iterationState.current,
						iterationState.total,
						`Max retries (${maxRetries}) exceeded. Last error: ${categorizedError.message}`,
						{ exitCode: result.exitCode, maxRetries },
					);
					set({
						isStreaming: false,
						error: `Max retries (${maxRetries}) exceeded. Last error: ${categorizedError.message}`,
						exitCode: result.exitCode,
						retryCount: retryCountRef,
					});
					break;
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error("Unexpected error during agent execution", { error: errorMessage });
			set({
				isStreaming: false,
				error: errorMessage,
				retryCount: retryCountRef,
			});
		} finally {
			processRef = null;
			clearShutdownHandler();
		}
	},

	stop: () => {
		abortedRef = true;
		if (processRef) {
			processRef.kill();
			processRef = null;
		}
		set({
			isStreaming: false,
		});
	},

	reset: () => {
		const { stop } = get();
		stop();
		set(INITIAL_STATE);
	},

	clearOutput: () => {
		set({ output: "" });
	},
}));
