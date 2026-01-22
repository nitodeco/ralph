import {
	getEffectiveConfig,
	invalidateConfigCache,
	loadGlobalConfig,
	saveGlobalConfig,
} from "@/lib/config.ts";
import { CLI_SEPARATOR_WIDTH } from "@/lib/constants/ui.ts";
import { createGitHubOAuthService } from "@/lib/services/github-oauth/index.ts";

const SLEEP_BUFFER_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskToken(token: string): string {
	if (token.length <= 8) {
		return "****";
	}

	const firstFour = token.slice(0, 4);
	const lastFour = token.slice(-4);

	return `${firstFour}...${lastFour}`;
}

export function printAuthStatus(version: string, jsonOutput: boolean): void {
	const { effective } = getEffectiveConfig();
	const gitProvider = effective.gitProvider;
	const hasOAuth = gitProvider?.github?.oauth?.accessToken !== undefined;
	const hasPat = gitProvider?.github?.token !== undefined && gitProvider.github.token.length > 0;

	if (jsonOutput) {
		const output = {
			authenticated: hasOAuth || hasPat,
			method: hasOAuth ? "oauth" : hasPat ? "pat" : null,
			oauth: hasOAuth
				? {
						scope: gitProvider?.github?.oauth?.scope,
						createdAt: gitProvider?.github?.oauth?.createdAt,
					}
				: null,
			pat: hasPat ? { configured: true } : null,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - GitHub Authentication Status\n`);

	if (hasOAuth) {
		console.log("\x1b[32m✓\x1b[0m Authenticated via OAuth");
		console.log(`  Scope: ${gitProvider?.github?.oauth?.scope ?? "repo"}`);
		console.log(`  Authenticated: ${gitProvider?.github?.oauth?.createdAt ?? "unknown"}`);
	} else if (hasPat) {
		console.log("\x1b[33m!\x1b[0m Authenticated via Personal Access Token (legacy)");
		console.log(`  Token: ${maskToken(gitProvider?.github?.token ?? "")}`);
		console.log("\n  Consider migrating to OAuth with: ralph auth login");
	} else {
		console.log("\x1b[31m✗\x1b[0m Not authenticated");
		console.log("\nAuthenticate with GitHub using: ralph auth login");
	}

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);
	console.log("\nCommands:");
	console.log("  ralph auth login   Authenticate via OAuth device flow");
	console.log("  ralph auth logout  Remove authentication");
	console.log("  ralph auth status  Show authentication status");
}

export async function handleAuthLogin(jsonOutput: boolean): Promise<void> {
	const oauthService = createGitHubOAuthService();

	if (!jsonOutput) {
		console.log("Initiating GitHub OAuth device flow...\n");
	}

	try {
		const deviceCode = await oauthService.requestDeviceCode();

		if (jsonOutput) {
			console.log(
				JSON.stringify({
					status: "awaiting_authorization",
					userCode: deviceCode.userCode,
					verificationUri: deviceCode.verificationUri,
					expiresInSeconds: deviceCode.expiresInSeconds,
				}),
			);
		} else {
			console.log("To authenticate, visit:");
			console.log(`\n  \x1b[36m${deviceCode.verificationUri}\x1b[0m\n`);
			console.log("And enter code:");
			console.log(`\n  \x1b[1m${deviceCode.userCode}\x1b[0m\n`);
			console.log("Waiting for authorization...");
		}

		const expiresAt = Date.now() + deviceCode.expiresInSeconds * 1_000;
		const pollIntervalMs = deviceCode.pollingIntervalSeconds * 1_000 + SLEEP_BUFFER_MS;

		while (Date.now() < expiresAt) {
			await sleep(pollIntervalMs);

			const result = await oauthService.pollForAccessToken(
				deviceCode.deviceCode,
				deviceCode.pollingIntervalSeconds,
			);

			if (result.status === "success") {
				const globalConfig = loadGlobalConfig();
				const updatedConfig = {
					...globalConfig,
					gitProvider: {
						...globalConfig.gitProvider,
						github: {
							...globalConfig.gitProvider?.github,
							token: undefined,
							oauth: {
								accessToken: result.token.accessToken,
								tokenType: result.token.tokenType,
								scope: result.token.scope,
								createdAt: new Date().toISOString(),
							},
						},
					},
				};

				saveGlobalConfig(updatedConfig);
				invalidateConfigCache();

				if (jsonOutput) {
					console.log(
						JSON.stringify({
							success: true,
							message: "Successfully authenticated with GitHub",
							scope: result.token.scope,
						}),
					);
				} else {
					console.log("\n\x1b[32m✓\x1b[0m Successfully authenticated with GitHub!");
					console.log(`  Scope: ${result.token.scope}`);
				}

				return;
			}

			if (result.status === "error") {
				if (jsonOutput) {
					console.log(JSON.stringify({ success: false, error: result.error }));
				} else {
					console.error(`\n\x1b[31m✗\x1b[0m Authentication failed: ${result.error}`);
				}

				process.exit(1);
			}
		}

		if (jsonOutput) {
			console.log(JSON.stringify({ success: false, error: "Authorization timed out" }));
		} else {
			console.error("\n\x1b[31m✗\x1b[0m Authorization timed out. Please try again.");
		}

		process.exit(1);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";

		if (jsonOutput) {
			console.log(JSON.stringify({ success: false, error: errorMessage }));
		} else {
			console.error(`\n\x1b[31m✗\x1b[0m Error: ${errorMessage}`);
		}

		process.exit(1);
	}
}

export async function handleAuthLogout(jsonOutput: boolean): Promise<void> {
	const { effective } = getEffectiveConfig();
	const gitProvider = effective.gitProvider;
	const hasOAuth = gitProvider?.github?.oauth?.accessToken !== undefined;
	const hasPat = gitProvider?.github?.token !== undefined && gitProvider.github.token.length > 0;

	if (!hasOAuth && !hasPat) {
		if (jsonOutput) {
			console.log(JSON.stringify({ success: false, error: "Not authenticated" }));
		} else {
			console.log("Not currently authenticated with GitHub.");
		}

		return;
	}

	if (hasOAuth) {
		const oauthService = createGitHubOAuthService();

		await oauthService.revokeToken(gitProvider?.github?.oauth?.accessToken ?? "");
	}

	const globalConfig = loadGlobalConfig();
	const updatedConfig = {
		...globalConfig,
		gitProvider: {
			...globalConfig.gitProvider,
			github: {
				...globalConfig.gitProvider?.github,
				token: undefined,
				oauth: undefined,
			},
		},
	};

	saveGlobalConfig(updatedConfig);
	invalidateConfigCache();

	if (jsonOutput) {
		console.log(JSON.stringify({ success: true, message: "Logged out successfully" }));
	} else {
		console.log("\x1b[32m✓\x1b[0m Logged out from GitHub");
	}
}
