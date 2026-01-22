import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { bootstrapTestServices, teardownTestServices } from "@/lib/services/bootstrap.ts";
import { createGitProviderService } from "@/lib/services/git-provider/implementation.ts";
import type { GitProviderService } from "@/lib/services/git-provider/types.ts";

describe("git-provider service", () => {
	let service: GitProviderService;

	beforeEach(() => {
		bootstrapTestServices();
		service = createGitProviderService();
	});

	afterEach(() => {
		teardownTestServices();
	});

	describe("detectProvider", () => {
		test("detects GitHub from SSH URL", () => {
			const result = service.detectProvider("git@github.com:owner/repo.git");

			expect(result.provider).toBe("github");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
			expect(result.hostname).toBe("github.com");
		});

		test("detects GitHub from HTTPS URL", () => {
			const result = service.detectProvider("https://github.com/owner/repo.git");

			expect(result.provider).toBe("github");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
			expect(result.hostname).toBe("github.com");
		});

		test("detects GitHub from HTTPS URL without .git suffix", () => {
			const result = service.detectProvider("https://github.com/owner/repo");

			expect(result.provider).toBe("github");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
		});

		test("detects GitLab from SSH URL", () => {
			const result = service.detectProvider("git@gitlab.com:owner/repo.git");

			expect(result.provider).toBe("gitlab");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
			expect(result.hostname).toBe("gitlab.com");
		});

		test("detects GitLab from HTTPS URL", () => {
			const result = service.detectProvider("https://gitlab.com/owner/repo.git");

			expect(result.provider).toBe("gitlab");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
		});

		test("detects Bitbucket from SSH URL", () => {
			const result = service.detectProvider("git@bitbucket.org:owner/repo.git");

			expect(result.provider).toBe("bitbucket");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
			expect(result.hostname).toBe("bitbucket.org");
		});

		test("detects Bitbucket from HTTPS URL", () => {
			const result = service.detectProvider("https://bitbucket.org/owner/repo.git");

			expect(result.provider).toBe("bitbucket");
			expect(result.owner).toBe("owner");
			expect(result.repo).toBe("repo");
		});

		test("returns none for unknown provider", () => {
			const result = service.detectProvider("git@unknown.host:owner/repo.git");

			expect(result.provider).toBe("none");
		});

		test("returns none for invalid URL", () => {
			const result = service.detectProvider("not-a-valid-url");

			expect(result.provider).toBe("none");
		});

		test("extracts hostname from SSH URL even for unknown providers", () => {
			const result = service.detectProvider("git@my-private-gitlab.com:owner/repo.git");

			expect(result.provider).toBe("none");
			expect(result.hostname).toBe("my-private-gitlab.com");
		});

		test("extracts hostname from HTTPS URL for unknown providers", () => {
			const result = service.detectProvider("https://my-private-gitlab.com/owner/repo.git");

			expect(result.provider).toBe("none");
			expect(result.hostname).toBe("my-private-gitlab.com");
		});
	});

	describe("getProvider", () => {
		test("returns null when no provider is registered", () => {
			const remoteInfo = service.detectProvider("git@github.com:owner/repo.git");
			const provider = service.getProvider(remoteInfo);

			expect(provider).toBeNull();
		});

		test("returns null for none provider type", () => {
			const remoteInfo = service.detectProvider("git@unknown.host:owner/repo.git");
			const provider = service.getProvider(remoteInfo);

			expect(provider).toBeNull();
		});
	});

	describe("getProviderForRemote", () => {
		test("returns null when no provider is registered", () => {
			const provider = service.getProviderForRemote("git@github.com:owner/repo.git");

			expect(provider).toBeNull();
		});
	});

	describe("isProviderConfigured", () => {
		test("returns false for none provider", () => {
			const isConfigured = service.isProviderConfigured("none");

			expect(isConfigured).toBe(false);
		});

		test("returns false when no token is configured", () => {
			const isConfigured = service.isProviderConfigured("github");

			expect(isConfigured).toBe(false);
		});
	});

	describe("getSupportedProviders", () => {
		test("returns empty array when no providers are registered", () => {
			const providers = service.getSupportedProviders();

			expect(providers).toEqual([]);
		});
	});
});
