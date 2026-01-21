import { parseStreamJsonLine } from "@/lib/agent-stream.ts";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { MAX_STUCK_CHECK_INTERVAL_MS, STUCK_CHECK_INTERVAL_DIVISOR } from "@/lib/constants/ui.ts";
import type { AgentType, IterationLogRetryContext } from "@/types.ts";
import { getAgentCommand } from "./config.ts";
import { categorizeAgentErrorFull, createError, ErrorCode, formatErrorCompact } from "./errors.ts";
import { eventBus } from "./events.ts";
import { analyzeFailure, type FailureAnalysis, generateRetryContext } from "./failure-analyzer.ts";
import { getLogger } from "./logger.ts";
import { COMPLETION_MARKER } from "./prompt.ts";
import { AgentProcessManager } from "./services/AgentProcessManager.ts";
import { calculateRetryDelay, createThrottledFunction, sleep } from "./utils.ts";

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

		if (this.config.emitEvents) {
			eventBus.emit("agent:start", { agentType: this.config.agentType });
		}

		while (AgentProcessManager.getRetryCount() <= maxRetries && !AgentProcessManager.isAborted()) {
			const result = await this.runOnce({
				prompt,
				additionalContext: currentRetryContext,
				outputThrottleMs,
			});

			if (result.success || AgentProcessManager.isAborted()) {
				const finalResult: AgentRunResult = {
					...result,
					retryCount: AgentProcessManager.getRetryCount(),
					retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
				};

				if (this.config.emitEvents && !AgentProcessManager.isAborted()) {
					eventBus.emit("agent:complete", {
						isComplete: result.isComplete,
						exitCode: result.exitCode,
						output: result.output,
						retryCount: AgentProcessManager.getRetryCount(),
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
					});
				}

				return finalResult;
			}

			const categorizedError = categorizeAgentErrorFull(result.error ?? "", result.exitCode);

			if (categorizedError.category === "fatal") {
				const errorWithSuggestion = categorizedError.suggestion
					? `${categorizedError.message}\n\nSuggestion: ${categorizedError.suggestion}`
					: categorizedError.message;

				logger.error("Fatal error encountered, not retrying", {
					error: categorizedError.message,
					code: categorizedError.code,
					exitCode: result.exitCode,
				});

				if (this.config.emitEvents) {
					eventBus.emit("agent:error", {
						error: errorWithSuggestion,
						exitCode: result.exitCode,
						isFatal: true,
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
					});
				}

				return {
					...result,
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
					failureAnalysis = analyzeFailure(result.error ?? "", result.output, result.exitCode);
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
				}

				if (this.config.onRetry) {
					this.config.onRetry(currentRetryCount, maxRetries, delay, categorizedError.message);
				}

				if (this.config.emitEvents) {
					eventBus.emit("agent:retry", {
						retryCount: currentRetryCount,
						maxRetries,
						delayMs: delay,
						failureAnalysis: failureAnalysis ?? undefined,
					});
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
						exitCode: result.exitCode,
						retryCount: AgentProcessManager.getRetryCount(),
					},
				);

				logger.error("Max retries exceeded", {
					maxRetries,
					lastError: categorizedError.message,
					code: maxRetriesError.code,
					exitCode: result.exitCode,
				});

				const errorMessage = maxRetriesError.suggestion
					? `${formatErrorCompact(maxRetriesError)}\nLast error: ${categorizedError.message}\n\nSuggestion: ${maxRetriesError.suggestion}`
					: `${formatErrorCompact(maxRetriesError)}\nLast error: ${categorizedError.message}`;

				if (this.config.emitEvents) {
					eventBus.emit("agent:error", {
						error: errorMessage,
						exitCode: result.exitCode,
						isFatal: true,
						retryContexts: retryContexts.length > 0 ? retryContexts : undefined,
					});
				}

				return {
					...result,
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

		const readStdout = async () => {
			while (!AgentProcessManager.isAborted()) {
				const { done, value } = await stdoutReader.read();

				if (done) {
					break;
				}

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
						throttledSetOutput(parsedOutput);
					}
				}
			}
		};

		const readStderr = async () => {
			while (!AgentProcessManager.isAborted()) {
				const { done, value } = await stderrReader.read();

				if (done) {
					break;
				}

				updateLastActivity();
				stderrOutput += decoder.decode(value);
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

			flushOutput();
			AgentProcessManager.setProcess(null);
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

	abort(): void {
		AgentProcessManager.kill();
	}

	isAborted(): boolean {
		return AgentProcessManager.isAborted();
	}
}
