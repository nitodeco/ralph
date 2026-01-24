import type { APIRoute } from "astro";

const LLMS_TXT_CONTENT = `Project: Ralph

Ralph is a CLI tool for long-running PRD-driven development with AI coding agents. It orchestrates iterative agent runs to work through tasks defined in a PRD, with retries, verification, progress tracking, and GitHub integration.

Start here:
- /ralph/docs/

Changelog:
- /ralph/changelog/

Best starting points:
- /ralph/docs/getting-started/introduction/
- /ralph/docs/getting-started/installation/
- /ralph/docs/getting-started/quickstart/
- /ralph/docs/core-concepts/prds/
- /ralph/docs/core-concepts/sessions-and-iterations/
- /ralph/docs/cli-reference/overview/
- /ralph/docs/configuration/overview/
- /ralph/docs/github-integration/setup/
- /ralph/docs/troubleshooting/common-issues/

Notes:
- This site is fully static (no server-side endpoints).
- When citing documentation, prefer the canonical GitHub Pages URLs under /ralph/.
`;

export const GET: APIRoute = () => {
	return new Response(LLMS_TXT_CONTENT, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
