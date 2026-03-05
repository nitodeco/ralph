import { getConfigService } from "@/lib/services/container.ts";
import { createGitHubOAuthService } from "@/lib/services/github-oauth/index.ts";
import type {
  GitProvider,
  GitProviderConfig,
  GitProviderOAuthTokens,
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
  errors?: {
    message?: string;
    resource?: string;
    field?: string;
    code?: string;
  }[];
}

function mapGitHubPrToResult(pr: GitHubPullRequestResponse): PullRequest {
  return {
    base: pr.base.ref,
    body: pr.body,
    createdAt: pr.created_at,
    head: pr.head.ref,
    isDraft: pr.draft,
    number: pr.number,
    state: pr.merged ? "merged" : pr.state,
    title: pr.title,
    updatedAt: pr.updated_at,
    url: pr.html_url,
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

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function isTokenExpired(oauth: GitProviderOAuthTokens): boolean {
  if (!oauth.expiresAt) {
    return false;
  }

  const expiresAt = new Date(oauth.expiresAt).getTime();
  const now = Date.now();

  return now >= expiresAt - TOKEN_EXPIRY_BUFFER_MS;
}

async function refreshTokenIfNeeded(oauth: GitProviderOAuthTokens): Promise<string | undefined> {
  if (!isTokenExpired(oauth)) {
    return oauth.accessToken;
  }

  if (!oauth.refreshToken) {
    return oauth.accessToken;
  }

  const oauthService = createGitHubOAuthService();
  const result = await oauthService.refreshAccessToken(oauth.refreshToken);

  if (result.status !== "success") {
    return undefined;
  }

  const configService = getConfigService();
  const globalConfig = configService.loadGlobal();
  const updatedConfig = {
    ...globalConfig,
    gitProvider: {
      ...globalConfig.gitProvider,
      github: {
        ...globalConfig.gitProvider?.github,
        oauth: {
          accessToken: result.token.accessToken,
          createdAt: oauth.createdAt,
          expiresAt: result.token.expiresAt,
          refreshToken: result.token.refreshToken,
          refreshTokenExpiresAt: result.token.refreshTokenExpiresAt,
          scope: result.token.scope,
          tokenType: result.token.tokenType,
        },
      },
    },
  };

  configService.saveGlobal(updatedConfig);
  configService.invalidateAll();

  return result.token.accessToken;
}

async function getValidToken(): Promise<string | undefined> {
  const { effective } = getConfigService().getEffective();
  const githubConfig = effective.gitProvider?.github;

  if (!githubConfig) {
    return undefined;
  }

  if (githubConfig.oauth?.accessToken) {
    return refreshTokenIfNeeded(githubConfig.oauth);
  }

  return githubConfig.token;
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
  const initialToken = getEffectiveToken(config);
  const isConfigured = initialToken !== undefined && initialToken.length > 0;
  const usesOAuth = config.oauth?.accessToken !== undefined;

  async function getHeaders(): Promise<Record<string, string>> {
    let token: string | undefined;

    if (usesOAuth) {
      token = await getValidToken();
    } else {
      ({ token } = config);
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  async function createPullRequest(
    options: PullRequestCreateOptions,
  ): Promise<ProviderOperationResult<PullRequest>> {
    if (!isConfigured) {
      return {
        error: "GitHub token is not configured",
        success: false,
      };
    }

    const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls`;
    const body = {
      base: options.base,
      body: options.body ?? "",
      draft: options.isDraft ?? false,
      head: options.head,
      title: options.title,
    };

    try {
      const headers = await getHeaders();
      const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorMessage = await parseGitHubError(response);

        return {
          error: errorMessage,
          success: false,
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
        data: pullRequest,
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false,
      };
    }
  }

  async function getPullRequest(prNumber: number): Promise<ProviderOperationResult<PullRequest>> {
    if (!isConfigured) {
      return {
        error: "GitHub token is not configured",
        success: false,
      };
    }

    const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`;

    try {
      const headers = await getHeaders();
      const response = await fetch(url, {
        headers,
        method: "GET",
      });

      if (!response.ok) {
        const errorMessage = await parseGitHubError(response);

        return {
          error: errorMessage,
          success: false,
        };
      }

      const prData = (await response.json()) as GitHubPullRequestResponse;

      return {
        data: mapGitHubPrToResult(prData),
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false,
      };
    }
  }

  async function updatePullRequest(
    prNumber: number,
    options: PullRequestUpdateOptions,
  ): Promise<ProviderOperationResult<PullRequest>> {
    if (!isConfigured) {
      return {
        error: "GitHub token is not configured",
        success: false,
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
      const headers = await getHeaders();
      const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        const errorMessage = await parseGitHubError(response);

        return {
          error: errorMessage,
          success: false,
        };
      }

      const prData = (await response.json()) as GitHubPullRequestResponse;

      return {
        data: mapGitHubPrToResult(prData),
        success: true,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        success: false,
      };
    }
  }

  async function closePullRequest(prNumber: number): Promise<ProviderOperationResult<void>> {
    const result = await updatePullRequest(prNumber, { state: "closed" });

    if (!result.success) {
      return {
        error: result.error,
        success: false,
      };
    }

    return {
      success: true,
    };
  }

  async function addLabels(prNumber: number, labels: string[]): Promise<void> {
    const url = `${apiBaseUrl}/repos/${owner}/${repo}/issues/${prNumber}/labels`;
    const headers = await getHeaders();

    await fetch(url, {
      body: JSON.stringify({ labels }),
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  }

  async function addReviewers(prNumber: number, reviewers: string[]): Promise<void> {
    const url = `${apiBaseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/requested_reviewers`;
    const headers = await getHeaders();

    await fetch(url, {
      body: JSON.stringify({ reviewers }),
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  }

  return {
    closePullRequest,
    createPullRequest,
    getPullRequest,
    isConfigured,
    type: "github",
    updatePullRequest,
  };
}
