export interface GitHubOAuthConfig {
	clientId: string;
	scope: string;
}

export interface DeviceCodeResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresInSeconds: number;
	pollingIntervalSeconds: number;
}

export interface OAuthTokenResponse {
	accessToken: string;
	tokenType: string;
	scope: string;
	expiresAt?: string;
	refreshToken?: string;
	refreshTokenExpiresAt?: string;
}

export interface OAuthError {
	error: string;
	errorDescription?: string;
}

export type DeviceFlowPollResult =
	| { status: "pending" }
	| { status: "success"; token: OAuthTokenResponse }
	| { status: "error"; error: string };

export type RefreshTokenResult =
	| { status: "success"; token: OAuthTokenResponse }
	| { status: "error"; error: string };

export interface GitHubOAuthService {
	requestDeviceCode(): Promise<DeviceCodeResponse>;
	pollForAccessToken(deviceCode: string, intervalSeconds: number): Promise<DeviceFlowPollResult>;
	refreshAccessToken(refreshToken: string): Promise<RefreshTokenResult>;
	revokeToken(token: string): Promise<boolean>;
	getClientId(): string;
}
