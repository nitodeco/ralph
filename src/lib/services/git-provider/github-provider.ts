import type {
	GitProvider,
	GitProviderConfig,
	ProviderOperationResult,
	PullRequest,
	PullRequestCreateOptions,
	PullRequestUpdateOptions,
	RemoteInfo,
} from "./types.ts";

interface GitHubPullRequestResponse {
	number: number;
	html_url: string;
	title: string;
	body: string | null;
	state: "open" | "closed";
	merged: boolean;
	draft: boolean;
	head: {
		ref: string;
	};
	base: {
		ref: string;
	};
	created_at: string;
	updated_at: string;
}

interface GitHubErrorResponse {
	message: string;
	errors?: Array<{
		message?: string;
		resource?: string;
		field?: string;
		code?: string;
	}>;
}

function mapGitHubPrToResult(pr: GitHubPullRequestResponse): PullRequest {
	return {
		number: pr.number,
		url: pr.html_url,
		title: pr.title,
		body: pr.body,
		state: pr.merged ? "merged" : pr.state,
		head: pr.head.ref,
		base: pr.base.ref,
		isDraft: pr.draft,
		createdAt: pr.created_at,
		updatedAt: pr.updated_at,
	};
}

async function parseGitHubError(response: Response): Promise<string> {
	try {
		const errorBody = (await response.json()) as GitHubErrorResponse;
		const errorMessages = errorBody.errors?.map((e) => e.message).filter(Boolean);
		const additionalInfo = errorMessages?.length ? `: ${errorMessages.join(", ")}` : "";

		return `${errorBody.message}${additionalInfo}`;
	} catch {
		return `HTTP ${response.status}: ${response.statusText}`;
	}
}

function getEffectiveToken(config: GitProviderConfig): string | undefined {
	if (config.oauth?.accessToken) {
		return config.oauth.accessToken;
	}

	return config.token;
}

export function createGitHubProvider(
	remoteInfo: RemoteInfo,
	config: GitProviderConfig,
): GitProvider {
	const { owner, repo } = remoteInfo;
	const apiBaseUrl = config.apiUrl ?? "https://api.github.com";
	const effectiveToken = getEffectiveToken(config);
	const isConfigured = effectiveToken !== undefined && effectiveToken.length > 0;

	function getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};

		if (effectiveToken) {
			headers.Authorization = `Bearer ${effectiveToken}`;
		}

		return headers;
	}

	async function createPullRequest(
		options: PullRequestCreateOptions,
	): Promise<ProviderOperationResult<PullRequest>> {
		if (!isConfigured) {
			return {
				success: false,
				error: "GitHub token is not configured",
			};
		}

		const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls`;
		const body = {
			title: options.title,
			body: options.body ?? "",
			head: options.head,
			base: options.base,
			draft: options.isDraft ?? false,
		};

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					...getHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errorMessage = await parseGitHubError(response);

				return {
					success: false,
					error: errorMessage,
				};
			}

			const prData = (await response.json()) as GitHubPullRequestResponse;
			const pullRequest = mapGitHubPrToResult(prData);

			if (options.labels?.length || options.reviewers?.length) {
				await Promise.all([
					options.labels?.length
						? addLabels(pullRequest.number, options.labels)
						: Promise.resolve(),
					options.reviewers?.length
						? addReviewers(pullRequest.number, options.reviewers)
						: Promise.resolve(),
				]);
			}

			return {
				success: true,
				data: pullRequest,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	async function getPullRequest(prNumber: number): Promise<ProviderOperationResult<PullRequest>> {
		if (!isConfigured) {
			return {
				success: false,
				error: "GitHub token is not configured",
			};
		}

		const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;

		try {
			const response = await fetch(url, {
				method: "GET",
				headers: getHeaders(),
			});

			if (!response.ok) {
				const errorMessage = await parseGitHubError(response);

				return {
					success: false,
					error: errorMessage,
				};
			}

			const prData = (await response.json()) as GitHubPullRequestResponse;

			return {
				success: true,
				data: mapGitHubPrToResult(prData),
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	async function updatePullRequest(
		prNumber: number,
		options: PullRequestUpdateOptions,
	): Promise<ProviderOperationResult<PullRequest>> {
		if (!isConfigured) {
			return {
				success: false,
				error: "GitHub token is not configured",
			};
		}

		const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;
		const body: Record<string, string> = {};

		if (options.title !== undefined) {
			body.title = options.title;
		}

		if (options.body !== undefined) {
			body.body = options.body;
		}

		if (options.state !== undefined) {
			body.state = options.state;
		}

		try {
			const response = await fetch(url, {
				method: "PATCH",
				headers: {
					...getHeaders(),
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errorMessage = await parseGitHubError(response);

				return {
					success: false,
					error: errorMessage,
				};
			}

			const prData = (await response.json()) as GitHubPullRequestResponse;

			return {
				success: true,
				data: mapGitHubPrToResult(prData),
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
			};
		}
	}

	async function closePullRequest(prNumber: number): Promise<ProviderOperationResult<void>> {
		const result = await updatePullRequest(prNumber, { state: "closed" });

		if (!result.success) {
			return {
				success: false,
				error: result.error,
			};
		}

		return {
			success: true,
		};
	}

	async function addLabels(prNumber: number, labels: string[]): Promise<void> {
		const url = `${apiBaseUrl}/repos/${owner}/${repo}/issues/${prNumber}/labels`;

		await fetch(url, {
			method: "POST",
			headers: {
				...getHeaders(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ labels }),
		});
	}

	async function addReviewers(prNumber: number, reviewers: string[]): Promise<void> {
		const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`;

		await fetch(url, {
			method: "POST",
			headers: {
				...getHeaders(),
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ reviewers }),
		});
	}

	return {
		type: "github",
		isConfigured,
		createPullRequest,
		getPullRequest,
		updatePullRequest,
		closePullRequest,
	};
}
