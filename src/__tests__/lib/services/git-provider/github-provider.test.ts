import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createGitHubProvider } from "@/lib/services/git-provider/github-provider.ts";
import type { RemoteInfo } from "@/lib/services/git-provider/types.ts";

const mockRemoteInfo: RemoteInfo = {
	provider: "github",
	owner: "test-owner",
	repo: "test-repo",
	hostname: "github.com",
};

function createMockFetch(responseOrError: Response | Error): typeof fetch {
	const mockFn = async () => {
		if (responseOrError instanceof Error) {
			throw responseOrError;
		}

		return responseOrError;
	};

	return mockFn as unknown as typeof fetch;
}

function createMockFetchWithCapture(
	response: Response,
	capture: { url?: string; body?: string; headers?: Record<string, string> },
): typeof fetch {
	const mockFn = async (input: string | URL | Request, init?: RequestInit) => {
		capture.url = typeof input === "string" ? input : input.toString();
		capture.body = init?.body as string | undefined;
		capture.headers = init?.headers as Record<string, string> | undefined;

		return response;
	};

	return mockFn as unknown as typeof fetch;
}

function createMockResponse(data: unknown, ok = true, status = 200, statusText = "OK"): Response {
	return {
		ok,
		status,
		statusText,
		json: () => Promise.resolve(data),
	} as Response;
}

describe("GitHub Provider", () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		bootstrapTestServices();
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		teardownTestServices();
		globalThis.fetch = originalFetch;
	});

	describe("createGitHubProvider", () => {
		test("creates provider with correct type", () => {
			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			expect(provider.type).toBe("github");
		});

		test("isConfigured returns true when token is provided", () => {
			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			expect(provider.isConfigured).toBe(true);
		});

		test("isConfigured returns false when token is not provided", () => {
			const provider = createGitHubProvider(mockRemoteInfo, {});

			expect(provider.isConfigured).toBe(false);
		});

		test("isConfigured returns false when token is empty string", () => {
			const provider = createGitHubProvider(mockRemoteInfo, { token: "" });

			expect(provider.isConfigured).toBe(false);
		});
	});

	describe("createPullRequest", () => {
		test("returns error when not configured", async () => {
			const provider = createGitHubProvider(mockRemoteInfo, {});
			const result = await provider.createPullRequest({
				title: "Test PR",
				head: "feature-branch",
				base: "main",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("GitHub token is not configured");
		});

		test("creates pull request successfully", async () => {
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Test PR",
				body: "Test body",
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetch(createMockResponse(mockResponseData));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.createPullRequest({
				title: "Test PR",
				body: "Test body",
				head: "feature-branch",
				base: "main",
			});

			expect(result.success).toBe(true);
			expect(result.data?.number).toBe(42);
			expect(result.data?.title).toBe("Test PR");
			expect(result.data?.url).toBe("https://github.com/test-owner/test-repo/pull/42");
			expect(result.data?.state).toBe("open");
			expect(result.data?.head).toBe("feature-branch");
			expect(result.data?.base).toBe("main");
		});

		test("handles API error response", async () => {
			const errorResponse = createMockResponse(
				{
					message: "Validation Failed",
					errors: [{ message: "A pull request already exists" }],
				},
				false,
				422,
				"Unprocessable Entity",
			);

			globalThis.fetch = createMockFetch(errorResponse);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.createPullRequest({
				title: "Test PR",
				head: "feature-branch",
				base: "main",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Validation Failed: A pull request already exists");
		});

		test("handles network error", async () => {
			globalThis.fetch = createMockFetch(new Error("Network error"));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.createPullRequest({
				title: "Test PR",
				head: "feature-branch",
				base: "main",
			});

			expect(result.success).toBe(false);
			expect(result.error).toBe("Network error");
		});

		test("sends correct request body with draft option", async () => {
			const capture: { body?: string } = {};
			const mockResponseData = {
				number: 1,
				html_url: "https://github.com/test-owner/test-repo/pull/1",
				title: "Test",
				body: null,
				state: "open",
				merged: false,
				draft: true,
				head: { ref: "feature" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			await provider.createPullRequest({
				title: "Test",
				head: "feature",
				base: "main",
				isDraft: true,
			});

			const parsedBody = JSON.parse(capture.body ?? "{}");

			expect(parsedBody.draft).toBe(true);
		});

		test("uses custom API URL when provided", async () => {
			const capture: { url?: string } = {};
			const mockResponseData = {
				number: 1,
				html_url: "https://github.example.com/test-owner/test-repo/pull/1",
				title: "Test",
				body: null,
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, {
				token: "test-token",
				apiUrl: "https://api.github.example.com",
			});

			await provider.createPullRequest({
				title: "Test",
				head: "feature",
				base: "main",
			});

			expect(capture.url).toContain("https://api.github.example.com");
		});
	});

	describe("getPullRequest", () => {
		test("returns error when not configured", async () => {
			const provider = createGitHubProvider(mockRemoteInfo, {});
			const result = await provider.getPullRequest(42);

			expect(result.success).toBe(false);
			expect(result.error).toBe("GitHub token is not configured");
		});

		test("retrieves pull request successfully", async () => {
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Test PR",
				body: "Test body",
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetch(createMockResponse(mockResponseData));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.getPullRequest(42);

			expect(result.success).toBe(true);
			expect(result.data?.number).toBe(42);
			expect(result.data?.title).toBe("Test PR");
		});

		test("returns merged state when PR is merged", async () => {
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Test PR",
				body: "Test body",
				state: "closed",
				merged: true,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetch(createMockResponse(mockResponseData));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.getPullRequest(42);

			expect(result.success).toBe(true);
			expect(result.data?.state).toBe("merged");
		});

		test("handles not found error", async () => {
			const errorResponse = createMockResponse({ message: "Not Found" }, false, 404, "Not Found");

			globalThis.fetch = createMockFetch(errorResponse);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.getPullRequest(9999);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Not Found");
		});
	});

	describe("updatePullRequest", () => {
		test("returns error when not configured", async () => {
			const provider = createGitHubProvider(mockRemoteInfo, {});
			const result = await provider.updatePullRequest(42, { title: "Updated Title" });

			expect(result.success).toBe(false);
			expect(result.error).toBe("GitHub token is not configured");
		});

		test("updates pull request title successfully", async () => {
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Updated Title",
				body: "Test body",
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-02T00:00:00Z",
			};

			globalThis.fetch = createMockFetch(createMockResponse(mockResponseData));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.updatePullRequest(42, { title: "Updated Title" });

			expect(result.success).toBe(true);
			expect(result.data?.title).toBe("Updated Title");
		});

		test("sends correct request body for partial update", async () => {
			const capture: { body?: string } = {};
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Updated Title",
				body: "Original body",
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-02T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			await provider.updatePullRequest(42, { title: "Updated Title" });

			const parsedBody = JSON.parse(capture.body ?? "{}");

			expect(parsedBody.title).toBe("Updated Title");
			expect(parsedBody.body).toBeUndefined();
		});
	});

	describe("closePullRequest", () => {
		test("returns error when not configured", async () => {
			const provider = createGitHubProvider(mockRemoteInfo, {});
			const result = await provider.closePullRequest(42);

			expect(result.success).toBe(false);
			expect(result.error).toBe("GitHub token is not configured");
		});

		test("closes pull request successfully", async () => {
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Test PR",
				body: "Test body",
				state: "closed",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-02T00:00:00Z",
			};

			globalThis.fetch = createMockFetch(createMockResponse(mockResponseData));

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });
			const result = await provider.closePullRequest(42);

			expect(result.success).toBe(true);
		});

		test("sends state=closed in request body", async () => {
			const capture: { body?: string } = {};
			const mockResponseData = {
				number: 42,
				html_url: "https://github.com/test-owner/test-repo/pull/42",
				title: "Test PR",
				body: "Test body",
				state: "closed",
				merged: false,
				draft: false,
				head: { ref: "feature-branch" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-02T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			await provider.closePullRequest(42);

			const parsedBody = JSON.parse(capture.body ?? "{}");

			expect(parsedBody.state).toBe("closed");
		});
	});

	describe("request headers", () => {
		test("includes authorization header with bearer token", async () => {
			const capture: { headers?: Record<string, string> } = {};
			const mockResponseData = {
				number: 1,
				html_url: "https://github.com/test-owner/test-repo/pull/1",
				title: "Test",
				body: null,
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "my-secret-token" });

			await provider.getPullRequest(1);

			expect(capture.headers?.Authorization).toBe("Bearer my-secret-token");
		});

		test("includes GitHub API version header", async () => {
			const capture: { headers?: Record<string, string> } = {};
			const mockResponseData = {
				number: 1,
				html_url: "https://github.com/test-owner/test-repo/pull/1",
				title: "Test",
				body: null,
				state: "open",
				merged: false,
				draft: false,
				head: { ref: "feature" },
				base: { ref: "main" },
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			globalThis.fetch = createMockFetchWithCapture(createMockResponse(mockResponseData), capture);

			const provider = createGitHubProvider(mockRemoteInfo, { token: "test-token" });

			await provider.getPullRequest(1);

			expect(capture.headers?.["X-GitHub-Api-Version"]).toBe("2022-11-28");
			expect(capture.headers?.Accept).toBe("application/vnd.github+json");
		});
	});
});
