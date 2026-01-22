export type GitProviderType = "github" | "gitlab" | "bitbucket" | "none";

export type PullRequestState = "open" | "closed" | "merged";

export interface PullRequestCreateOptions {
	title: string;
	body?: string;
	head: string;
	base: string;
	isDraft?: boolean;
	reviewers?: string[];
	labels?: string[];
}

export interface PullRequestUpdateOptions {
	title?: string;
	body?: string;
	state?: "open" | "closed";
}

export interface PullRequest {
	number: number;
	url: string;
	title: string;
	body: string | null;
	state: PullRequestState;
	head: string;
	base: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ProviderOperationResult<T = void> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface RemoteInfo {
	provider: GitProviderType;
	owner: string;
	repo: string;
	hostname: string;
}

export interface GitProviderConfig {
	token?: string;
	apiUrl?: string;
}

export interface GitProvider {
	readonly type: GitProviderType;
	readonly isConfigured: boolean;

	createPullRequest(
		options: PullRequestCreateOptions,
	): Promise<ProviderOperationResult<PullRequest>>;

	getPullRequest(prNumber: number): Promise<ProviderOperationResult<PullRequest>>;

	updatePullRequest(
		prNumber: number,
		options: PullRequestUpdateOptions,
	): Promise<ProviderOperationResult<PullRequest>>;

	closePullRequest(prNumber: number): Promise<ProviderOperationResult<void>>;
}

export interface GitProviderService {
	detectProvider(remoteUrl: string): RemoteInfo;
	getProvider(remoteInfo: RemoteInfo): GitProvider | null;
	getProviderForRemote(remoteUrl: string): GitProvider | null;
	isProviderConfigured(providerType: GitProviderType): boolean;
	getSupportedProviders(): GitProviderType[];
}
