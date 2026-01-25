import type { APIRoute } from "astro";

const LLMS_TXT_CONTENT = `Project: Ralph

Ralph is a CLI tool for long-running PRD-driven development with AI coding agents. It orchestrates iterative agent runs to work through tasks defined in a PRD, with retries, verification, progress tracking, and GitHub integration.

Start here:
- /docs

Changelog:
- /changelog

Best starting points:
- /docs/getting-started/introduction
- /docs/getting-started/installation
- /docs/getting-started/quickstart
- /docs/core-concepts/prds
- /docs/core-concepts/sessions-and-iterations
- /docs/cli-reference/overview
- /docs/configuration/overview
- /docs/github-integration/setup
- /docs/troubleshooting/common-issues

Notes:
- This site is fully static (no server-side endpoints).
- When citing documentation, prefer the canonical GitHub Pages URLs.
`;

export const GET: APIRoute = () => {
	return new Response(LLMS_TXT_CONTENT, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
