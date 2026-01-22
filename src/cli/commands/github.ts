import {
	getEffectiveConfig,
	invalidateConfigCache,
	loadGlobalConfig,
	saveGlobalConfig,
} from "@/lib/config.ts";
import { CLI_SEPARATOR_WIDTH } from "@/lib/constants/ui.ts";

function maskToken(token: string): string {
	if (token.length <= 8) {
		return "****";
	}

	const firstFour = token.slice(0, 4);
	const lastFour = token.slice(-4);

	return `${firstFour}...${lastFour}`;
}

export function printGitHubConfig(version: string, jsonOutput: boolean): void {
	const { effective } = getEffectiveConfig();
	const gitProvider = effective.gitProvider;
	const hasOAuth = gitProvider?.github?.oauth?.accessToken !== undefined;
	const hasPat = gitProvider?.github?.token !== undefined && gitProvider.github.token.length > 0;
	const isConfigured = hasOAuth || hasPat;

	if (jsonOutput) {
		const output = {
			configured: isConfigured,
			authMethod: hasOAuth ? "oauth" : hasPat ? "pat" : null,
			oauth: hasOAuth
				? {
						scope: gitProvider?.github?.oauth?.scope,
						createdAt: gitProvider?.github?.oauth?.createdAt,
					}
				: null,
			pat: hasPat ? { token: maskToken(gitProvider?.github?.token ?? "") } : null,
			autoCreatePr: gitProvider?.autoCreatePr ?? false,
			prDraft: gitProvider?.prDraft ?? true,
			prLabels: gitProvider?.prLabels ?? [],
			prReviewers: gitProvider?.prReviewers ?? [],
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`◆ ralph v${version} - GitHub Configuration\n`);
	console.log("GitHub Integration:");

	if (hasOAuth) {
		console.log(`  Auth:           OAuth (authenticated)`);
		console.log(`  Scope:          ${gitProvider?.github?.oauth?.scope ?? "repo"}`);
	} else if (hasPat) {
		console.log(`  Auth:           PAT ${maskToken(gitProvider?.github?.token ?? "")}`);
	} else {
		console.log(`  Auth:           (not configured)`);
	}

	console.log(`  Auto-Create PR: ${gitProvider?.autoCreatePr ? "enabled" : "disabled"}`);
	console.log(`  PR Draft Mode:  ${gitProvider?.prDraft ? "enabled" : "disabled"}`);

	if (gitProvider?.prLabels && gitProvider.prLabels.length > 0) {
		console.log(`  PR Labels:      ${gitProvider.prLabels.join(", ")}`);
	}

	if (gitProvider?.prReviewers && gitProvider.prReviewers.length > 0) {
		console.log(`  PR Reviewers:   ${gitProvider.prReviewers.join(", ")}`);
	}

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);

	if (hasOAuth) {
		console.log("\n\x1b[32m✓\x1b[0m GitHub integration configured via OAuth");
		console.log("\nCommands:");
		console.log("  ralph auth logout               Disconnect from GitHub");
		console.log("  ralph auth status               Show auth status");
	} else if (hasPat) {
		console.log("\n\x1b[33m!\x1b[0m GitHub integration configured via PAT (legacy)");
		console.log("\n  Consider migrating to OAuth for improved security:");
		console.log("  ralph auth login");
		console.log("\nCommands:");
		console.log("  ralph github set-token <token>  Update PAT");
		console.log("  ralph github clear-token        Remove PAT");
	} else {
		console.log("\nGitHub not configured. Authenticate using:");
		console.log("  ralph auth login                OAuth (recommended)");
		console.log("  ralph github set-token <token>  PAT (legacy)");
	}
}

export function handleGitHubSetToken(token: string | undefined, jsonOutput: boolean): void {
	if (!token || token.trim() === "") {
		if (jsonOutput) {
			console.log(JSON.stringify({ success: false, error: "Token is required" }));
		} else {
			console.error("Error: Token is required");
			console.error("Usage: ralph github set-token <token>");
		}

		process.exit(1);
	}

	const globalConfig = loadGlobalConfig();
	const updatedConfig = {
		...globalConfig,
		gitProvider: {
			...globalConfig.gitProvider,
			github: { ...globalConfig.gitProvider?.github, token: token.trim() },
		},
	};

	saveGlobalConfig(updatedConfig);
	invalidateConfigCache();

	if (jsonOutput) {
		console.log(JSON.stringify({ success: true, message: "GitHub token saved" }));
	} else {
		console.log("\x1b[32m✓\x1b[0m GitHub token saved successfully");
	}
}

export function handleGitHubClearToken(jsonOutput: boolean): void {
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
		console.log(JSON.stringify({ success: true, message: "GitHub credentials cleared" }));
	} else {
		console.log("\x1b[32m✓\x1b[0m GitHub credentials cleared");
	}
}
