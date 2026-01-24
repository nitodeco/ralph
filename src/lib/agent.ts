import { parseStreamJsonLine } from "@/lib/agent-stream.ts";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import {
	MAX_STUCK_CHECK_INTERVAL_MS,
	PROCESS_EXIT_TIMEOUT_MS,
	STUCK_CHECK_INTERVAL_DIVISOR,
} from "@/lib/constants/ui.ts";
import type { AgentType, IterationLogRetryContext } from "@/types.ts";
import { createCompletionDetector } from "./completion-detector.ts";
import { parseDecompositionRequest } from "./decomposition.ts";
import {
	categorizeAgentErrorFull,
	createError,
	ErrorCode,
	formatErrorCompact,
	getErrorMessage,
} from "./errors.ts";
import { eventBus } from "./events.ts";
import { analyzeFailure, type FailureAnalysis, generateRetryContext } from "./failure-analyzer.ts";
import { getLogger } from "./logger.ts";
import { COMPLETION_MARKER } from "./prompt.ts";
import { AgentProcessManager } from "./services/AgentProcessManager.ts";
import { getAgentCommand } from "./services/index.ts";
import { calculateRetryDelay, createThrottledFunction, sleep, withTimeout } from "./utils.ts";

export interface RunAgentWithPromptOptions {
	prompt: string;
	agentType: AgentType;
	onOutput?: (chunk: string) => void;
}

export interface RunAgentWithPromptResult {
	promise: Promise<string>;
	abort: () => void;
}

export function runAgentWithPrompt({
	prompt,
	agentType,
	onOutput,
}: RunAgentWithPromptOptions): RunAgentWithPromptResult {
	const baseCommand = getAgentCommand(agentType);
	let isAborted = false;

	const agentProcess = Bun.spawn([...baseCommand, prompt], {
		stdin: null,
		stdout: "pipe",
		stderr: "pipe",
	});

	const abort = () => {
		isAborted = true;

		try {
			agentProcess.kill("SIGTERM");
		} catch {
			// Process may have already exited
		}

		setTimeout(() => {
			try {
				agentProcess.kill("SIGKILL");
			} catch {
				// Process may have already exited
			}
		}, 1_000);
	};

	const promise = (async (): Promise<string> => {
		const parsedOutputChunks: string[] = [];
		const stdoutReader = agentProcess.stdout.getReader();
		const decoder = new TextDecoder();
		let lineBuffer = "";

		while (!isAborted) {
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

		if (lineBuffer && !isAborted) {
			const parsedText = parseStreamJsonLine(lineBuffer);

			if (parsedText) {
				parsedOutputChunks.push(parsedText);

				if (onOutput) {
					onOutput(parsedText);
				}
			}
		}

		await agentProcess.exited;

		if (isAborted) {
			throw new Error("Agent generation was cancelled");
		}

		return parsedOutputChunks.join("");
	})();

	return { promise, abort };
}

export interface AgentRunnerConfig {
	agentType: AgentType;
	timeoutMs?: number;
	stuckThresholdMs?: number;
	maxRetries?: number;
	retryDelayMs?: number;
	retryWithContext?: boolean;
	outputThrottleMs?: number;
	logFilePath?: string;
	onOutput: (output: string) => void;
	onRetry?: (count: number, max: number, delay: number, reason: string) => void;
	emitEvents?: boolean;
}

export interface AgentRunResult {
	success: boolean;
	exitCode: number | null;
	output: string;
	isComplete: boolean;
	error?: string;
	retryCount: number;
	isFatal?: boolean;
	retryContexts?: IterationLogRetryContext[];
}

export class AgentRunner {
	private config: AgentRunnerConfig;

	constructor(config: AgentRunnerConfig) {
		this.config = config;
	}

	async run(prompt: string): Promise<AgentRunResult> {
		AgentProcessManager.reset();

		const maxRetries = this.config.maxRetries ?? DEFAULTS.maxRetries;
		const retryDelayMs = this.config.retryDelayMs ?? DEFAULTS.retryDelayMs;
		const retryWithContext = this.config.retryWithContext ?? DEFAULTS.retryWithContext;
		const outputThrottleMs = this.config.outputThrottleMs ?? 100;
		const logger = getLogger({ logFilePath: this.config.logFilePath });
		const retryContexts: IterationLogRetryContext[] = [];
		let currentRetryContext: string | null = null;

		while (AgentProcessManager.getRetryCount() <= maxRetries && !AgentProcessManager.isAborted()) {
			const runAttemptResult = await this.runOnce({
				prompt,
				additionalContext: currentRetryContext,
				outputThrottleMs,
			});

			if (runAttemptResult.success || AgentProcessManager.isAborted()) {
				const finalResult: AgentRunResult = {
					...runAttemptResult,
					retryCount: AgentProcessManager.getRetryCount(),
					retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
				};

				if (this.config.emitEvents && !AgentProcessManager.isAborted()) {
					const OUTPUT_PREVIEW_LENGTH = 500;
					const decompositionResult = parseDecompositionRequest(runAttemptResult.output);

					eventBus.emit("agent:complete", {
						isComplete: runAttemptResult.isComplete,
						exitCode: runAttemptResult.exitCode,
						outputLength: runAttemptResult.output.length,
						outputPreview: runAttemptResult.output.slice(0, OUTPUT_PREVIEW_LENGTH),
						retryCount: AgentProcessManager.getRetryCount(),
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
						hasDecompositionRequest: decompositionResult.detected,
						decompositionRequest: decompositionResult.request ?? undefined,
					});
				}

				return finalResult;
			}

			const categorizedError = categorizeAgentErrorFull(
				runAttemptResult.error ?? "",
				runAttemptResult.exitCode,
			);

			if (categorizedError.category === "fatal") {
				const errorWithSuggestion = categorizedError.suggestion
					? `${categorizedError.message}\n\nSuggestion: ${categorizedError.suggestion}`
					: categorizedError.message;

				logger.error("Fatal error encountered, not retrying", {
					error: categorizedError.message,
					code: categorizedError.code,
					exitCode: runAttemptResult.exitCode,
				});

				if (this.config.emitEvents) {
					eventBus.emit("agent:error", {
						error: errorWithSuggestion,
						exitCode: runAttemptResult.exitCode,
						isFatal: true,
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
					});
				}

				return {
					...runAttemptResult,
					retryCount: AgentProcessManager.getRetryCount(),
					isFatal: true,
					error: `Fatal error [${categorizedError.code}]: ${errorWithSuggestion}`,
					retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
				};
			}

			if (AgentProcessManager.getRetryCount() < maxRetries) {
				const currentRetryCount = AgentProcessManager.incrementRetry();
				const delay = calculateRetryDelay(retryDelayMs, currentRetryCount - 1);

				let failureAnalysis: FailureAnalysis | null = null;

				if (retryWithContext) {
					try {
						failureAnalysis = analyzeFailure(
							runAttemptResult.error ?? "",
							runAttemptResult.output,
							runAttemptResult.exitCode,
						);
						currentRetryContext = generateRetryContext(failureAnalysis, currentRetryCount);

						const retryContextEntry: IterationLogRetryContext = {
							attemptNumber: currentRetryCount,
							failureCategory: failureAnalysis.category,
							rootCause: failureAnalysis.rootCause,
							contextInjected: currentRetryContext,
						};

						retryContexts.push(retryContextEntry);

						logger.info("Failure analysis for retry", {
							attemptNumber: currentRetryCount,
							category: failureAnalysis.category,
							rootCause: failureAnalysis.rootCause,
							suggestedApproach: failureAnalysis.suggestedApproach,
						});
					} catch (analysisError) {
						logger.warn("Failed to analyze failure, retrying without context", {
							error: getErrorMessage(analysisError),
						});
						currentRetryContext = null;
					}
				}

				if (this.config.onRetry) {
					try {
						this.config.onRetry(currentRetryCount, maxRetries, delay, categorizedError.message);
					} catch (callbackError) {
						logger.warn("onRetry callback threw an error", {
							error: getErrorMessage(callbackError),
						});
					}
				}

				await sleep(delay);

				if (AgentProcessManager.isAborted()) {
					break;
				}
			} else {
				const maxRetriesError = createError(
					ErrorCode.AGENT_MAX_RETRIES,
					`Max retries (${maxRetries}) exceeded`,
					{
						lastError: categorizedError.message,
						exitCode: runAttemptResult.exitCode,
						retryCount: AgentProcessManager.getRetryCount(),
					},
				);

				logger.error("Max retries exceeded", {
					maxRetries,
					lastError: categorizedError.message,
					code: maxRetriesError.code,
					exitCode: runAttemptResult.exitCode,
				});

				const errorMessage = maxRetriesError.suggestion
					? `${formatErrorCompact(maxRetriesError)}\nLast error: ${categorizedError.message}\n\nSuggestion: ${maxRetriesError.suggestion}`
					: `${formatErrorCompact(maxRetriesError)}\nLast error: ${categorizedError.message}`;

				if (this.config.emitEvents) {
					eventBus.emit("agent:error", {
						error: errorMessage,
						exitCode: runAttemptResult.exitCode,
						isFatal: true,
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
					});
				}

				return {
					...runAttemptResult,
					retryCount: AgentProcessManager.getRetryCount(),
					error: errorMessage,
					isFatal: true,
					retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
				};
			}
		}

		return {
			success: false,
			exitCode: null,
			output: "",
			isComplete: false,
			retryCount: AgentProcessManager.getRetryCount(),
			error: "Agent execution was aborted",
			retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
		};
	}

	private async runOnce(options: {
		prompt: string;
		additionalContext?: string | null;
		outputThrottleMs: number;
	}): Promise<Omit<AgentRunResult, "retryCount" | "retryContexts">> {
		const { prompt, additionalContext, outputThrottleMs } = options;
		const logger = getLogger({ logFilePath: this.config.logFilePath });
		const baseCommand = getAgentCommand(this.config.agentType);
		const agentTimeoutMs = this.config.timeoutMs ?? DEFAULTS.agentTimeoutMs;
		const stuckThresholdMs = this.config.stuckThresholdMs ?? DEFAULTS.stuckThresholdMs;
		const effectivePrompt = additionalContext ? `${prompt}\n\n${additionalContext}` : prompt;

		const { throttled: throttledSetOutput, flush: flushOutput } = createThrottledFunction(
			this.config.onOutput,
			outputThrottleMs,
		);

		logger.logAgentStart(this.config.agentType, effectivePrompt);

		const agentProcess = Bun.spawn([...baseCommand, effectivePrompt], {
			stdin: null,
			stdout: "pipe",
			stderr: "pipe",
		});

		AgentProcessManager.setProcess(agentProcess);

		const stdoutReader = agentProcess.stdout.getReader();
		const stderrReader = agentProcess.stderr.getReader();
		const decoder = new TextDecoder();
		const completionDetector = createCompletionDetector(COMPLETION_MARKER);
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

						const currentProcess = AgentProcessManager.getProcess();

						if (currentProcess) {
							currentProcess.kill();
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

								const currentProcess = AgentProcessManager.getProcess();

								if (currentProcess) {
									currentProcess.kill();
								}
							}
						},
						Math.min(stuckThresholdMs / STUCK_CHECK_INTERVAL_DIVISOR, MAX_STUCK_CHECK_INTERVAL_MS),
					)
				: null;

		const safeDecodeText = (value: Uint8Array): string => {
			try {
				return decoder.decode(value);
			} catch (decodeError) {
				logger.warn("Failed to decode stream data, using lossy decoding", {
					error: getErrorMessage(decodeError),
					byteLength: value.length,
				});

				return decoder.decode(value, { stream: true });
			}
		};

		const safeCallOutputHandler = (output: string): void => {
			try {
				throttledSetOutput(output);
			} catch (handlerError) {
				logger.warn("Output handler threw an error", {
					error: getErrorMessage(handlerError),
				});
			}
		};

		const streamState = { error: null as Error | null };

		const readStdout = async () => {
			try {
				while (!AgentProcessManager.isAborted()) {
					const { done, value } = await stdoutReader.read();

					if (done) {
						break;
					}

					updateLastActivity();
					const text = safeDecodeText(value);

					completionDetector.feed(text);
					lineBuffer += text;

					const lines = lineBuffer.split("\n");

					lineBuffer = lines.pop() ?? "";

					for (const line of lines) {
						const parsedText = parseStreamJsonLine(line);

						if (parsedText && parsedText !== lastParsedText) {
							lastParsedText = parsedText;
							parsedOutput = parsedText;
							safeCallOutputHandler(parsedOutput);
						}
					}
				}
			} catch (error) {
				streamState.error = error instanceof Error ? error : new Error(String(error));
				logger.error("Error reading stdout stream", { error: getErrorMessage(error) });
			} finally {
				try {
					stdoutReader.releaseLock();
				} catch {
					// Reader lock may already be released
				}
			}
		};

		const readStderr = async () => {
			try {
				while (!AgentProcessManager.isAborted()) {
					const { done, value } = await stderrReader.read();

					if (done) {
						break;
					}

					updateLastActivity();
					stderrOutput += safeDecodeText(value);
				}
			} catch (error) {
				logger.warn("Error reading stderr stream", { error: getErrorMessage(error) });
			} finally {
				try {
					stderrReader.releaseLock();
				} catch {
					// Reader lock may already be released
				}
			}
		};

		try {
			await Promise.all([readStdout(), readStderr()]);
		} finally {
			if (timeoutTimer) {
				clearTimeout(timeoutTimer);
			}

			if (stuckCheckInterval) {
				clearInterval(stuckCheckInterval);
			}

			try {
				stdoutReader.releaseLock();
			} catch {
				// Reader lock may already be released
			}

			try {
				stderrReader.releaseLock();
			} catch {
				// Reader lock may already be released
			}

			flushOutput();
			AgentProcessManager.setProcess(null);
		}

		if (streamState.error) {
			const streamErrorMessage = createError(
				ErrorCode.AGENT_STREAM_ERROR,
				`Stream read error: ${streamState.error.message}`,
				{ originalError: streamState.error.message },
			);

			logger.logAgentError(streamErrorMessage.message, null);

			return {
				success: false,
				exitCode: null,
				output: parsedOutput,
				isComplete: false,
				error: formatErrorCompact(streamErrorMessage),
			};
		}

		let exitCode: number | null = null;

		try {
			exitCode = await withTimeout(
				agentProcess.exited,
				PROCESS_EXIT_TIMEOUT_MS,
				"Process exit wait timed out",
			);
		} catch (exitError) {
			const hangError = createError(
				ErrorCode.AGENT_PROCESS_HANG,
				`Process did not exit cleanly: ${getErrorMessage(exitError)}`,
			);

			logger.error("Process exit wait failed", { error: getErrorMessage(exitError) });

			try {
				agentProcess.kill("SIGKILL");
			} catch {
				// Process may have already exited
			}

			return {
				success: false,
				exitCode: null,
				output: parsedOutput,
				isComplete: false,
				error: formatErrorCompact(hangError),
			};
		}

		const isComplete = completionDetector.isComplete();

		if (timeoutTriggered) {
			const errorMessage = `Agent timed out after ${Math.round(agentTimeoutMs / 1_000 / 60)} minutes`;

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
			const errorMessage = `Agent stuck (no output for ${Math.round(stuckThresholdMs / 1_000 / 60)} minutes)`;

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

	abort(): void {
		AgentProcessManager.kill();
	}

	isAborted(): boolean {
		return AgentProcessManager.isAborted();
	}
}
