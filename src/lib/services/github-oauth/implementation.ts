import type { DeviceCodeResponse, DeviceFlowPollResult, GitHubOAuthService } from "./types.ts";

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_REVOKE_URL = "https://api.github.com/applications";

const DEFAULT_CLIENT_ID = "Ov23liPHLsmJOnq88Hf9";
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
	error?: string;
	error_description?: string;
}

export function createGitHubOAuthService(
	clientId: string = DEFAULT_CLIENT_ID,
	scope: string = DEFAULT_SCOPE,
): GitHubOAuthService {
	async function requestDeviceCode(): Promise<DeviceCodeResponse> {
		const response = await fetch(GITHUB_DEVICE_CODE_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				client_id: clientId,
				scope,
			}).toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();

			throw new Error(`Failed to request device code: ${response.status} ${errorText}`);
		}

		const deviceCodeResponse = (await response.json()) as GitHubDeviceCodeApiResponse;

		return {
			deviceCode: deviceCodeResponse.device_code,
			userCode: deviceCodeResponse.user_code,
			verificationUri: deviceCodeResponse.verification_uri,
			expiresInSeconds: deviceCodeResponse.expires_in,
			pollingIntervalSeconds: deviceCodeResponse.interval,
		};
	}

	async function pollForAccessToken(
		deviceCode: string,
		_intervalSeconds: number,
	): Promise<DeviceFlowPollResult> {
		const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				client_id: clientId,
				device_code: deviceCode,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			}).toString(),
		});

		if (!response.ok) {
			const errorText = await response.text();

			return {
				status: "error",
				error: `HTTP ${response.status}: ${errorText}`,
			};
		}

		const tokenResponse = (await response.json()) as GitHubAccessTokenApiResponse;

		if (tokenResponse.error) {
			if (tokenResponse.error === "authorization_pending" || tokenResponse.error === "slow_down") {
				return { status: "pending" };
			}

			return {
				status: "error",
				error: tokenResponse.error_description ?? tokenResponse.error,
			};
		}

		if (tokenResponse.access_token) {
			return {
				status: "success",
				token: {
					accessToken: tokenResponse.access_token,
					tokenType: tokenResponse.token_type ?? "bearer",
					scope: tokenResponse.scope ?? scope,
				},
			};
		}

		return {
			status: "error",
			error: "Unexpected response from GitHub",
		};
	}

	async function revokeToken(token: string): Promise<boolean> {
		try {
			const response = await fetch(`${GITHUB_REVOKE_URL}/${clientId}/token`, {
				method: "DELETE",
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token}`,
					"X-GitHub-Api-Version": "2022-11-28",
				},
				body: JSON.stringify({ access_token: token }),
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
		requestDeviceCode,
		pollForAccessToken,
		revokeToken,
		getClientId,
	};
}
