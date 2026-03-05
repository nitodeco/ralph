import type {
  AgentType,
  BranchModeConfig,
  GitProviderConfig,
  RalphConfig,
  VerificationConfig,
} from "./types.ts";

export const DEFAULTS = {
  agent: "cursor" as const,
  agentTimeoutMs: 30 * 60 * 1000,
  enableGcHints: true,
  iterationDelayMs: 2000,
  iterations: 10,
  learningEnabled: true,
  maxDecompositionsPerTask: 2,
  maxOutputBufferBytes: 5 * 1024 * 1024,
  maxRetries: 3,
  memoryThresholdMb: 1024,
  memoryWarningThresholdMb: 500,
  retryDelayMs: 5000,
  retryWithContext: true,
  stuckThresholdMs: 5 * 60 * 1000,
} as const;

export const DEFAULT_VERIFICATION: VerificationConfig = {
  enabled: false,
  failOnWarning: false,
};

export const DEFAULT_BRANCH_MODE: BranchModeConfig = {
  branchPrefix: "ralph",
  enabled: false,
  pushAfterCommit: true,
  returnToBaseBranch: true,
};

export const DEFAULT_GIT_PROVIDER: GitProviderConfig = {
  autoCreatePr: false,
  prDraft: true,
};

export const CONFIG_DEFAULTS: Required<
  Omit<RalphConfig, "lastUpdateCheck" | "skipVersion" | "hasAcknowledgedWarning" | "logFilePath">
> = {
  agent: DEFAULTS.agent,
  agentTimeoutMs: DEFAULTS.agentTimeoutMs,
  branchMode: DEFAULT_BRANCH_MODE,
  gitProvider: DEFAULT_GIT_PROVIDER,
  learningEnabled: DEFAULTS.learningEnabled,
  maxDecompositionsPerTask: DEFAULTS.maxDecompositionsPerTask,
  maxOutputHistoryBytes: DEFAULTS.maxOutputBufferBytes,
  maxRetries: DEFAULTS.maxRetries,
  maxRuntimeMs: 0,
  memory: {
    enableGarbageCollectionHints: DEFAULTS.enableGcHints,
    maxOutputBufferBytes: DEFAULTS.maxOutputBufferBytes,
    memoryThresholdMb: DEFAULTS.memoryThresholdMb,
    memoryWarningThresholdMb: DEFAULTS.memoryWarningThresholdMb,
  },
  notifications: {
    markerFilePath: undefined,
    systemNotification: false,
    webhookUrl: undefined,
  },
  retryDelayMs: DEFAULTS.retryDelayMs,
  retryWithContext: DEFAULTS.retryWithContext,
  stuckThresholdMs: DEFAULTS.stuckThresholdMs,
  technicalDebtReview: {
    enabled: true,
  },
  verification: DEFAULT_VERIFICATION,
  workflowMode: "standard",
};

export const DEFAULT_CONFIG: RalphConfig = {
  agent: DEFAULTS.agent,
  maxRetries: DEFAULTS.maxRetries,
  retryDelayMs: DEFAULTS.retryDelayMs,
};

export const VALID_AGENTS: AgentType[] = ["cursor", "claude", "codex"];

export const DEFAULT_AGENT_TIMEOUT_MS = DEFAULTS.agentTimeoutMs;
export const DEFAULT_STUCK_THRESHOLD_MS = DEFAULTS.stuckThresholdMs;
export const DEFAULT_MAX_OUTPUT_BUFFER_BYTES = DEFAULTS.maxOutputBufferBytes;
export const DEFAULT_MEMORY_WARNING_THRESHOLD_MB = DEFAULTS.memoryWarningThresholdMb;
export const DEFAULT_MEMORY_THRESHOLD_MB = DEFAULTS.memoryThresholdMb;
export const DEFAULT_ENABLE_GC_HINTS = DEFAULTS.enableGcHints;

export const AGENT_COMMANDS: Record<AgentType, string[]> = {
  claude: [
    "claude",
    "-p",
    "--dangerously-skip-permissions",
    "--output-format",
    "stream-json",
    "--verbose",
  ],
  codex: ["codex", "exec", "--full-auto", "--json"],
  cursor: ["agent", "-p", "--force", "--output-format", "stream-json", "--stream-partial-output"],
};
