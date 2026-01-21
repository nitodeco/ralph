import { describe, expect, test } from "bun:test";
import {
	buildFolderName,
	createGitProjectIdentifier,
	createPathProjectIdentifier,
	createProjectIdentifier,
	hashPath,
	normalizeGitRemote,
	sanitizeFolderName,
} from "@/lib/services/project-registry/resolution.ts";

describe("normalizeGitRemote", () => {
	test("strips https protocol", () => {
		const result = normalizeGitRemote("https://github.com/user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("strips http protocol", () => {
		const result = normalizeGitRemote("http://github.com/user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("strips git protocol", () => {
		const result = normalizeGitRemote("git://github.com/user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("strips ssh protocol", () => {
		const result = normalizeGitRemote("ssh://git@github.com/user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("converts SSH-style git@host:path to slash format", () => {
		const result = normalizeGitRemote("git@github.com:user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("strips .git suffix", () => {
		const result = normalizeGitRemote("https://github.com/user/repo.git");

		expect(result).toBe("github.com/user/repo");
	});

	test("handles URL without .git suffix", () => {
		const result = normalizeGitRemote("https://github.com/user/repo");

		expect(result).toBe("github.com/user/repo");
	});

	test("trims whitespace", () => {
		const result = normalizeGitRemote("  https://github.com/user/repo.git  ");

		expect(result).toBe("github.com/user/repo");
	});

	test("handles GitLab URLs", () => {
		const result = normalizeGitRemote("git@gitlab.com:group/subgroup/repo.git");

		expect(result).toBe("gitlab.com/group/subgroup/repo");
	});

	test("handles Bitbucket URLs", () => {
		const result = normalizeGitRemote("git@bitbucket.org:team/repo.git");

		expect(result).toBe("bitbucket.org/team/repo");
	});

	test("preserves port numbers in URLs", () => {
		const result = normalizeGitRemote("https://git.example.com:8443/user/repo.git");

		expect(result).toBe("git.example.com:8443/user/repo");
	});
});

describe("hashPath", () => {
	test("returns a 12-character hash", () => {
		const result = hashPath("/Users/test/project");

		expect(result).toHaveLength(12);
	});

	test("returns consistent hash for same path", () => {
		const path = "/Users/test/project";

		const hash1 = hashPath(path);
		const hash2 = hashPath(path);

		expect(hash1).toBe(hash2);
	});

	test("returns different hashes for different paths", () => {
		const hash1 = hashPath("/Users/test/project1");
		const hash2 = hashPath("/Users/test/project2");

		expect(hash1).not.toBe(hash2);
	});

	test("returns hexadecimal characters only", () => {
		const result = hashPath("/some/random/path");

		expect(result).toMatch(/^[a-f0-9]+$/);
	});
});

describe("sanitizeFolderName", () => {
	test("replaces invalid characters with dashes", () => {
		const result = sanitizeFolderName("github.com/user/repo");

		expect(result).toBe("github.com-user-repo");
	});

	test("collapses multiple dashes into one", () => {
		const result = sanitizeFolderName("a///b");

		expect(result).toBe("a-b");
	});

	test("removes leading and trailing dashes", () => {
		const result = sanitizeFolderName("/path/to/repo/");

		expect(result).toBe("path-to-repo");
	});

	test("converts to lowercase", () => {
		const result = sanitizeFolderName("GitHub.com/User/Repo");

		expect(result).toBe("github.com-user-repo");
	});

	test("preserves valid characters", () => {
		const result = sanitizeFolderName("my_project-1.0.0");

		expect(result).toBe("my_project-1.0.0");
	});

	test("handles special characters", () => {
		const result = sanitizeFolderName("project@2.0!#$%");

		expect(result).toBe("project-2.0");
	});
});

describe("buildFolderName", () => {
	test("builds git folder name with prefix", () => {
		const result = buildFolderName("git", "github.com/user/repo");

		expect(result).toBe("git--github.com-user-repo");
	});

	test("builds path folder name with prefix", () => {
		const result = buildFolderName("path", "abc123def456");

		expect(result).toBe("path--abc123def456");
	});

	test("builds custom folder name with prefix", () => {
		const result = buildFolderName("custom", "my-custom-id");

		expect(result).toBe("custom--my-custom-id");
	});

	test("sanitizes the value in the folder name", () => {
		const result = buildFolderName("git", "GitHub.com/User/Repo");

		expect(result).toBe("git--github.com-user-repo");
	});
});

describe("createProjectIdentifier", () => {
	test("creates git identifier with normalized remote", () => {
		const result = createProjectIdentifier("git", "git@github.com:user/repo.git");

		expect(result.type).toBe("git");
		expect(result.value).toBe("github.com/user/repo");
		expect(result.folderName).toBe("git--github.com-user-repo");
	});

	test("creates path identifier without normalization", () => {
		const result = createProjectIdentifier("path", "abc123");

		expect(result.type).toBe("path");
		expect(result.value).toBe("abc123");
		expect(result.folderName).toBe("path--abc123");
	});

	test("creates custom identifier", () => {
		const result = createProjectIdentifier("custom", "my-project");

		expect(result.type).toBe("custom");
		expect(result.value).toBe("my-project");
		expect(result.folderName).toBe("custom--my-project");
	});
});

describe("createGitProjectIdentifier", () => {
	test("creates identifier from HTTPS URL", () => {
		const result = createGitProjectIdentifier("https://github.com/user/repo.git");

		expect(result.type).toBe("git");
		expect(result.value).toBe("github.com/user/repo");
		expect(result.folderName).toBe("git--github.com-user-repo");
	});

	test("creates identifier from SSH URL", () => {
		const result = createGitProjectIdentifier("git@github.com:user/repo.git");

		expect(result.type).toBe("git");
		expect(result.value).toBe("github.com/user/repo");
		expect(result.folderName).toBe("git--github.com-user-repo");
	});
});

describe("createPathProjectIdentifier", () => {
	test("creates identifier from absolute path", () => {
		const result = createPathProjectIdentifier("/Users/test/my-project");

		expect(result.type).toBe("path");
		expect(result.value).toHaveLength(12);
		expect(result.folderName).toMatch(/^path--[a-f0-9]+$/);
	});

	test("creates consistent identifier for same path", () => {
		const path = "/Users/test/my-project";

		const result1 = createPathProjectIdentifier(path);
		const result2 = createPathProjectIdentifier(path);

		expect(result1.value).toBe(result2.value);
		expect(result1.folderName).toBe(result2.folderName);
	});

	test("creates different identifiers for different paths", () => {
		const result1 = createPathProjectIdentifier("/path/a");
		const result2 = createPathProjectIdentifier("/path/b");

		expect(result1.value).not.toBe(result2.value);
		expect(result1.folderName).not.toBe(result2.folderName);
	});
});
