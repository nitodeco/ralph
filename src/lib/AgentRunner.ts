import type { Subprocess } from "bun";
import type { AgentType } from "@/types.ts";
import { getAgentCommand } from "./config.ts";
import { DEFAULTS } from "./defaults.ts";
import { getLogger } from "./logger.ts";
import { COMPLETION_MARKER } from "./prompt.ts";

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

export interface AgentRunnerConfig {
	agentType: AgentType;
	timeoutMs?: number;
	stuckThresholdMs?: number;
	maxRetries?: number;
	retryDelayMs?: number;
	logFilePath?: string;
	onOutput: (output: string) => void;
	onRetry?: (count: number, max: number, delay: number, reason: string) => void;
}

export interface AgentRunResult {
	success: boolean;
	exitCode: number | null;
	output: string;
	isComplete: boolean;
	error?: string;
	retryCount: number;
	isFatal?: boolean;
}

export class AgentRunner {
	private config: AgentRunnerConfig;
	private process: Subprocess | null = null;
	private aborted = false;
	private retryCount = 0;

	constructor(config: AgentRunnerConfig) {
		this.config = config;
	}

	async run(prompt: string): Promise<AgentRunResult> {
		this.aborted = false;
		this.retryCount = 0;

		const maxRetries = this.config.maxRetries ?? DEFAULTS.maxRetries;
		const retryDelayMs = this.config.retryDelayMs ?? DEFAULTS.retryDelayMs;

		while (this.retryCount <= maxRetries && !this.aborted) {
			const result = await this.runOnce(prompt);

			if (result.success || this.aborted) {
				return { ...result, retryCount: this.retryCount };
			}

			const categorizedError = categorizeError(result.error ?? "", result.exitCode);

			if (categorizedError.category === "fatal") {
				return {
					...result,
					retryCount: this.retryCount,
					isFatal: true,
					error: `Fatal error: ${categorizedError.message}`,
				};
			}

			if (this.retryCount < maxRetries) {
				this.retryCount += 1;
				const delay = calculateRetryDelay(retryDelayMs, this.retryCount - 1);

				if (this.config.onRetry) {
					this.config.onRetry(this.retryCount, maxRetries, delay, categorizedError.message);
				}

				await sleep(delay);

				if (this.aborted) break;
			} else {
				return {
					...result,
					retryCount: this.retryCount,
					error: `Max retries (${maxRetries}) exceeded. Last error: ${categorizedError.message}`,
				};
			}
		}

		return {
			success: false,
			exitCode: null,
			output: "",
			isComplete: false,
			retryCount: this.retryCount,
			error: "Agent execution was aborted",
		};
	}

	private async runOnce(prompt: string): Promise<Omit<AgentRunResult, "retryCount">> {
		const logger = getLogger({ logFilePath: this.config.logFilePath });
		const baseCommand = getAgentCommand(this.config.agentType);
		const agentTimeoutMs = this.config.timeoutMs ?? DEFAULTS.agentTimeoutMs;
		const stuckThresholdMs = this.config.stuckThresholdMs ?? DEFAULTS.stuckThresholdMs;

		logger.logAgentStart(this.config.agentType, prompt);

		const agentProcess = Bun.spawn([...baseCommand, prompt], {
			stdin: null,
			stdout: "pipe",
			stderr: "pipe",
		});

		this.process = agentProcess;

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
						if (this.process) {
							this.process.kill();
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
								if (this.process) {
									this.process.kill();
								}
							}
						},
						Math.min(stuckThresholdMs / 4, 30000),
					)
				: null;

		const readStdout = async () => {
			while (!this.aborted) {
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
						this.config.onOutput(parsedOutput);
					}
				}
			}
		};

		const readStderr = async () => {
			while (!this.aborted) {
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

	abort(): void {
		this.aborted = true;
		if (this.process) {
			this.process.kill();
			this.process = null;
		}
	}

	isAborted(): boolean {
		return this.aborted;
	}
}
