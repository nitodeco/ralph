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
	const hasToken = gitProvider?.github?.token !== undefined;

	if (jsonOutput) {
		const output = {
			configured: hasToken,
			token: hasToken ? maskToken(gitProvider?.github?.token ?? "") : null,
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
	console.log(
		`  Token:          ${hasToken ? maskToken(gitProvider?.github?.token ?? "") : "(not configured)"}`,
	);
	console.log(`  Auto-Create PR: ${gitProvider?.autoCreatePr ? "enabled" : "disabled"}`);
	console.log(`  PR Draft Mode:  ${gitProvider?.prDraft ? "enabled" : "disabled"}`);

	if (gitProvider?.prLabels && gitProvider.prLabels.length > 0) {
		console.log(`  PR Labels:      ${gitProvider.prLabels.join(", ")}`);
	}

	if (gitProvider?.prReviewers && gitProvider.prReviewers.length > 0) {
		console.log(`  PR Reviewers:   ${gitProvider.prReviewers.join(", ")}`);
	}

	console.log(`\n${"─".repeat(CLI_SEPARATOR_WIDTH)}`);

	if (hasToken) {
		console.log("\n\x1b[32m✓\x1b[0m GitHub integration configured");
		console.log("\nCommands:");
		console.log("  ralph github set-token <token>  Update token");
		console.log("  ralph github clear-token        Remove token");
	} else {
		console.log("\nGitHub token not configured.");
		console.log("Set token with: ralph github set-token <token>");
		console.log("Create a token at: https://github.com/settings/tokens");
		console.log("Required scope: 'repo' for PR operations");
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
			github: { ...globalConfig.gitProvider?.github, token: undefined },
		},
	};

	saveGlobalConfig(updatedConfig);
	invalidateConfigCache();

	if (jsonOutput) {
		console.log(JSON.stringify({ success: true, message: "GitHub token cleared" }));
	} else {
		console.log("\x1b[32m✓\x1b[0m GitHub token cleared");
	}
}
