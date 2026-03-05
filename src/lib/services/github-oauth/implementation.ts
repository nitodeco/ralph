import type {
  DeviceCodeResponse,
  DeviceFlowPollResult,
  GitHubOAuthService,
  RefreshTokenResult,
} from "./types.ts";

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_REVOKE_URL = "https://api.github.com/applications";

const DEFAULT_CLIENT_ID = "Iv23liBwqlOKCuiXCLOo";
const DEFAULT_SCOPE = "repo";

interface GitHubDeviceCodeApiResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface GitHubAccessTokenApiResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
}

export function createGitHubOAuthService(
  clientId: string = DEFAULT_CLIENT_ID,
  scope: string = DEFAULT_SCOPE,
): GitHubOAuthService {
  async function requestDeviceCode(): Promise<DeviceCodeResponse> {
    const response = await fetch(GITHUB_DEVICE_CODE_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        scope,
      }).toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`Failed to request device code: ${response.status} ${errorText}`);
    }

    const deviceCodeResponse = (await response.json()) as GitHubDeviceCodeApiResponse;

    return {
      deviceCode: deviceCodeResponse.device_code,
      expiresInSeconds: deviceCodeResponse.expires_in,
      pollingIntervalSeconds: deviceCodeResponse.interval,
      userCode: deviceCodeResponse.user_code,
      verificationUri: deviceCodeResponse.verification_uri,
    };
  }

  async function pollForAccessToken(
    deviceCode: string,
    _intervalSeconds: number,
  ): Promise<DeviceFlowPollResult> {
    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }).toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();

      return {
        error: `HTTP ${response.status}: ${errorText}`,
        status: "error",
      };
    }

    const tokenResponse = (await response.json()) as GitHubAccessTokenApiResponse;

    if (tokenResponse.error) {
      if (tokenResponse.error === "authorization_pending" || tokenResponse.error === "slow_down") {
        return { status: "pending" };
      }

      return {
        error: tokenResponse.error_description ?? tokenResponse.error,
        status: "error",
      };
    }

    if (tokenResponse.access_token) {
      const now = Date.now();
      const expiresAt = tokenResponse.expires_in
        ? new Date(now + tokenResponse.expires_in * 1000).toISOString()
        : undefined;
      const refreshTokenExpiresAt = tokenResponse.refresh_token_expires_in
        ? new Date(now + tokenResponse.refresh_token_expires_in * 1000).toISOString()
        : undefined;

      return {
        status: "success",
        token: {
          accessToken: tokenResponse.access_token,
          expiresAt,
          refreshToken: tokenResponse.refresh_token,
          refreshTokenExpiresAt,
          scope: tokenResponse.scope ?? scope,
          tokenType: tokenResponse.token_type ?? "bearer",
        },
      };
    }

    return {
      error: "Unexpected response from GitHub",
      status: "error",
    };
  }

  async function refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult> {
    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      const errorText = await response.text();

      return {
        error: `HTTP ${response.status}: ${errorText}`,
        status: "error",
      };
    }

    const tokenResponse = (await response.json()) as GitHubAccessTokenApiResponse;

    if (tokenResponse.error) {
      return {
        error: tokenResponse.error_description ?? tokenResponse.error,
        status: "error",
      };
    }

    if (tokenResponse.access_token) {
      const now = Date.now();
      const expiresAt = tokenResponse.expires_in
        ? new Date(now + tokenResponse.expires_in * 1000).toISOString()
        : undefined;
      const refreshTokenExpiresAt = tokenResponse.refresh_token_expires_in
        ? new Date(now + tokenResponse.refresh_token_expires_in * 1000).toISOString()
        : undefined;

      return {
        status: "success",
        token: {
          accessToken: tokenResponse.access_token,
          expiresAt,
          refreshToken: tokenResponse.refresh_token,
          refreshTokenExpiresAt,
          scope: tokenResponse.scope ?? scope,
          tokenType: tokenResponse.token_type ?? "bearer",
        },
      };
    }

    return {
      error: "Unexpected response from GitHub",
      status: "error",
    };
  }

  async function revokeToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(`${GITHUB_REVOKE_URL}/${clientId}/token`, {
        body: JSON.stringify({ access_token: token }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: "DELETE",
      });

      return response.ok || response.status === 204;
    } catch {
      return false;
    }
  }

  function getClientId(): string {
    return clientId;
  }

  return {
    getClientId,
    pollForAccessToken,
    refreshAccessToken,
    requestDeviceCode,
    revokeToken,
  };
}
