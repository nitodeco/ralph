export type AgentType = "cursor" | "claude" | "codex";

export interface NotificationConfig {
	systemNotification?: boolean;
	webhookUrl?: string;
	markerFilePath?: string;
}

export type NotificationEvent =
	| "complete"
	| "max_iterations"
	| "fatal_error"
	| "input_required"
	| "session_paused"
	| "verification_failed";

export interface MemoryConfig {
	maxOutputBufferBytes?: number;
	memoryWarningThresholdMb?: number;
	enableGarbageCollectionHints?: boolean;
}

export interface VerificationConfig {
	enabled: boolean;
	buildCommand?: string;
	testCommand?: string;
	lintCommand?: string;
	customChecks?: string[];
	failOnWarning: boolean;
}

export type TechnicalDebtSeverity = "low" | "medium" | "high" | "critical";

export interface TechnicalDebtReviewConfig {
	enabled?: boolean;
	minSeverity?: TechnicalDebtSeverity;
	analyzeRetryPatterns?: boolean;
	analyzeVerificationFailures?: boolean;
	analyzeDecompositions?: boolean;
	analyzeErrorPatterns?: boolean;
	analyzePerformance?: boolean;
}

export type WorkflowMode = "standard" | "branches";

export interface BranchModeConfig {
	enabled: boolean;
	branchPrefix?: string;
	pushAfterCommit?: boolean;
	returnToBaseBranch?: boolean;
}

export interface GitHubOAuthTokens {
	accessToken: string;
	tokenType: string;
	scope: string;
	createdAt: string;
}

export interface GitProviderAuthConfig {
	token?: string;
	oauth?: GitHubOAuthTokens;
	apiUrl?: string;
}

export interface GitProviderConfig {
	github?: GitProviderAuthConfig;
	gitlab?: GitProviderAuthConfig;
	bitbucket?: GitProviderAuthConfig;
	autoCreatePr?: boolean;
	prDraft?: boolean;
	prLabels?: string[];
	prReviewers?: string[];
}

export interface RalphConfig {
	agent: AgentType;
	lastUpdateCheck?: number;
	skipVersion?: string;
	maxRetries?: number;
	retryDelayMs?: number;
	logFilePath?: string;
	agentTimeoutMs?: number;
	stuckThresholdMs?: number;
	notifications?: NotificationConfig;
	memory?: MemoryConfig;
	maxOutputHistoryBytes?: number;
	maxRuntimeMs?: number;
	retryWithContext?: boolean;
	verification?: VerificationConfig;
	technicalDebtReview?: TechnicalDebtReviewConfig;
	maxDecompositionsPerTask?: number;
	learningEnabled?: boolean;
	workflowMode?: WorkflowMode;
	branchMode?: BranchModeConfig;
	gitProvider?: GitProviderConfig;
	hasAcknowledgedWarning?: boolean;
}

export interface ConfigValidationError {
	field: string;
	message: string;
	value?: unknown;
}

export interface ConfigValidationResult {
	valid: boolean;
	errors: ConfigValidationError[];
	warnings: ConfigValidationError[];
}

export interface ConfigService {
	get(): RalphConfig;
	load(): RalphConfig;
	loadGlobal(): RalphConfig;
	loadGlobalRaw(): Partial<RalphConfig> | null;
	loadProjectRaw(): Partial<RalphConfig> | null;
	getWithValidation(validateFn: (config: unknown) => ConfigValidationResult): {
		config: RalphConfig;
		validation: ConfigValidationResult;
	};
	saveGlobal(config: RalphConfig): void;
	saveProject(config: RalphConfig): void;
	invalidate(): void;
	invalidateGlobal(): void;
	invalidateAll(): void;
	globalConfigExists(): boolean;
	getEffective(): {
		global: Partial<RalphConfig> | null;
		project: Partial<RalphConfig> | null;
		effective: RalphConfig;
	};
}
