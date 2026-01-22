import { create } from "zustand";
import { AgentRunner } from "@/lib/agent.ts";
import { detectPhaseFromOutput } from "@/lib/agent-phase.ts";
import { loadConfig } from "@/lib/config.ts";
import { DEFAULTS } from "@/lib/constants/defaults.ts";
import { GIT_STATS_POLL_INTERVAL_MS, OUTPUT_THROTTLE_MS } from "@/lib/constants/ui.ts";
import { clearShutdownHandler, setShutdownHandler } from "@/lib/daemon.ts";
import { getErrorMessage } from "@/lib/errors.ts";
import { getGitStatusStats } from "@/lib/git-stats.ts";
import { getLogger } from "@/lib/logger.ts";
import { getMaxOutputBytes, truncateOutputBuffer } from "@/lib/memory.ts";
import { isGitRepository } from "@/lib/paths.ts";
import { loadInstructions } from "@/lib/prd.ts";
import { buildPrompt } from "@/lib/prompt.ts";
import { AgentProcessManager } from "@/lib/services/index.ts";
import { useAgentStatusStore } from "./agentStatusStore.ts";

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
	start: (specificTask?: string | null) => Promise<void>;
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

export const useAgentStore = create<AgentStore>((set, get) => ({
	...INITIAL_STATE,

	setOutput: (output: string) => {
		const config = loadConfig();
		const maxBytes = getMaxOutputBytes(config.maxOutputHistoryBytes);
		const truncatedOutput = truncateOutputBuffer(output, maxBytes);

		const detectedPhase = detectPhaseFromOutput(output);

		useAgentStatusStore.getState().setPhase(detectedPhase);

		set({ output: truncatedOutput });
	},

	start: async (specificTask?: string | null) => {
		setShutdownHandler({
			onShutdown: () => {
				AgentProcessManager.setAborted(true);
				const currentProcess = AgentProcessManager.getProcess();

				if (currentProcess) {
					currentProcess.kill();
					AgentProcessManager.setProcess(null);
				}
			},
		});

		set({
			...INITIAL_STATE,
			isStreaming: true,
		});

		const statusStore = useAgentStatusStore.getState();

		statusStore.reset();
		statusStore.setPhase("starting");

		const config = loadConfig();
		const logger = getLogger({ logFilePath: config.logFilePath });
		const instructions = loadInstructions();
		const isInGitRepo = isGitRepository();
		const prompt = buildPrompt({ instructions, specificTask, isGitRepository: isInGitRepo });

		const agentRunner = new AgentRunner({
			agentType: config.agent,
			timeoutMs: config.agentTimeoutMs ?? DEFAULTS.agentTimeoutMs,
			stuckThresholdMs: config.stuckThresholdMs ?? DEFAULTS.stuckThresholdMs,
			maxRetries: config.maxRetries ?? DEFAULTS.maxRetries,
			retryDelayMs: config.retryDelayMs ?? DEFAULTS.retryDelayMs,
			retryWithContext: config.retryWithContext ?? DEFAULTS.retryWithContext,
			outputThrottleMs: OUTPUT_THROTTLE_MS,
			logFilePath: config.logFilePath,
			onOutput: get().setOutput,
			onRetry: (count, max, delay) => {
				logger.logAgentRetry(count, max, delay);
				set({
					isRetrying: true,
					retryCount: count,
					output: "",
				});
				setTimeout(() => {
					set({ isRetrying: false });
				}, delay);
			},
			emitEvents: true,
		});

		const gitStatsInterval = setInterval(() => {
			const stats = getGitStatusStats();

			useAgentStatusStore.getState().setFileChanges(stats);
		}, GIT_STATS_POLL_INTERVAL_MS);

		try {
			const agentRunResult = await agentRunner.run(prompt);

			if (AgentProcessManager.isAborted()) {
				set({
					isStreaming: false,
					isComplete: agentRunResult.isComplete,
					exitCode: agentRunResult.exitCode,
					retryCount: agentRunResult.retryCount,
					isRetrying: false,
				});

				return;
			}

			set({
				isStreaming: false,
				isComplete: agentRunResult.isComplete,
				exitCode: agentRunResult.exitCode,
				retryCount: agentRunResult.retryCount,
				error: agentRunResult.success ? null : (agentRunResult.error ?? "Unknown error"),
				isRetrying: false,
			});
		} catch (error) {
			const errorMessage = getErrorMessage(error);

			logger.error("Unexpected error during agent execution", { error: errorMessage });
			set({
				isStreaming: false,
				error: errorMessage,
				retryCount: AgentProcessManager.getRetryCount(),
				isRetrying: false,
			});
		} finally {
			clearInterval(gitStatsInterval);
			useAgentStatusStore.getState().setPhase("idle");
			AgentProcessManager.setProcess(null);
			clearShutdownHandler();
		}
	},

	stop: () => {
		AgentProcessManager.kill();
		set({
			isStreaming: false,
		});
	},

	reset: () => {
		AgentProcessManager.reset();
		useAgentStatusStore.getState().reset();
		set(INITIAL_STATE);
	},

	clearOutput: () => {
		set({ output: "" });
	},
}));
