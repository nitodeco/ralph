import { CLI_SEPARATOR_WIDTH } from "@/lib/constants/ui.ts";
import { getConfigService } from "@/lib/services/index.ts";

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "****";
  }

  const firstFour = token.slice(0, 4);
  const lastFour = token.slice(-4);

  return `${firstFour}...${lastFour}`;
}

export function printGitHubConfig(version: string, jsonOutput: boolean): void {
  const { effective } = getConfigService().getEffective();
  const { gitProvider } = effective;
  const hasOAuth = gitProvider?.github?.oauth?.accessToken !== undefined;
  const hasPat = gitProvider?.github?.token !== undefined && gitProvider.github.token.length > 0;
  const isConfigured = hasOAuth || hasPat;

  if (jsonOutput) {
    const output = {
      authMethod: hasOAuth ? "oauth" : hasPat ? "pat" : null,
      autoCreatePr: gitProvider?.autoCreatePr ?? false,
      configured: isConfigured,
      oauth: hasOAuth
        ? {
            createdAt: gitProvider?.github?.oauth?.createdAt,
            scope: gitProvider?.github?.oauth?.scope,
          }
        : null,
      pat: hasPat ? { token: maskToken(gitProvider?.github?.token ?? "") } : null,
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
      console.log(JSON.stringify({ error: "Token is required", success: false }));
    } else {
      console.error("Error: Token is required");
      console.error("Usage: ralph github set-token <token>");
    }

    process.exit(1);
  }

  const configService = getConfigService();
  const globalConfig = configService.loadGlobal();
  const updatedConfig = {
    ...globalConfig,
    gitProvider: {
      ...globalConfig.gitProvider,
      github: { ...globalConfig.gitProvider?.github, token: token.trim() },
    },
  };

  configService.saveGlobal(updatedConfig);
  configService.invalidateAll();

  if (jsonOutput) {
    console.log(JSON.stringify({ message: "GitHub token saved", success: true }));
  } else {
    console.log("\x1b[32m✓\x1b[0m GitHub token saved successfully");
  }
}

export function handleGitHubClearToken(jsonOutput: boolean): void {
  const configService = getConfigService();
  const globalConfig = configService.loadGlobal();
  const updatedConfig = {
    ...globalConfig,
    gitProvider: {
      ...globalConfig.gitProvider,
      github: {
        ...globalConfig.gitProvider?.github,
        oauth: undefined,
        token: undefined,
      },
    },
  };

  configService.saveGlobal(updatedConfig);
  configService.invalidateAll();

  if (jsonOutput) {
    console.log(JSON.stringify({ message: "GitHub credentials cleared", success: true }));
  } else {
    console.log("\x1b[32m✓\x1b[0m GitHub credentials cleared");
  }
}
