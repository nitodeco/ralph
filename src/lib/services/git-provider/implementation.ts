import { getConfigService } from "../container.ts";
import type {
	GitProvider,
	GitProviderConfig,
	GitProviderService,
	GitProviderType,
	RemoteInfo,
} from "./types.ts";

interface ProviderPatterns {
	type: GitProviderType;
	hostnames: string[];
	sshPattern: RegExp;
	httpsPattern: RegExp;
}

const PROVIDER_PATTERNS: ProviderPatterns[] = [
	{
		type: "github",
		hostnames: ["github.com"],
		sshPattern: /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/,
		httpsPattern: /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
	},
	{
		type: "gitlab",
		hostnames: ["gitlab.com"],
		sshPattern: /^git@gitlab\.com:([^/]+)\/(.+?)(?:\.git)?$/,
		httpsPattern: /^https?:\/\/gitlab\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
	},
	{
		type: "bitbucket",
		hostnames: ["bitbucket.org"],
		sshPattern: /^git@bitbucket\.org:([^/]+)\/(.+?)(?:\.git)?$/,
		httpsPattern: /^https?:\/\/bitbucket\.org\/([^/]+)\/(.+?)(?:\.git)?$/,
	},
];

function parseRemoteUrl(remoteUrl: string): RemoteInfo {
	const trimmedUrl = remoteUrl.trim();

	for (const pattern of PROVIDER_PATTERNS) {
		const sshMatch = trimmedUrl.match(pattern.sshPattern);

		if (sshMatch) {
			const [, owner, repo] = sshMatch;

			return {
				provider: pattern.type,
				owner: owner ?? "",
				repo: repo?.replace(/\.git$/, "") ?? "",
				hostname: pattern.hostnames.at(0) ?? "",
			};
		}

		const httpsMatch = trimmedUrl.match(pattern.httpsPattern);

		if (httpsMatch) {
			const [, owner, repo] = httpsMatch;

			return {
				provider: pattern.type,
				owner: owner ?? "",
				repo: repo?.replace(/\.git$/, "") ?? "",
				hostname: pattern.hostnames.at(0) ?? "",
			};
		}
	}

	return {
		provider: "none",
		owner: "",
		repo: "",
		hostname: extractHostname(trimmedUrl),
	};
}

function extractHostname(url: string): string {
	const sshMatch = url.match(/^git@([^:]+):/);

	if (sshMatch) {
		return sshMatch.at(1) ?? "";
	}

	try {
		const parsedUrl = new URL(url);

		return parsedUrl.hostname;
	} catch {
		return "";
	}
}

function getProviderConfig(providerType: GitProviderType): GitProviderConfig | null {
	const config = getConfigService().get();
	const gitProviderConfig = config.gitProvider;

	if (!gitProviderConfig) {
		return null;
	}

	switch (providerType) {
		case "github":
			return gitProviderConfig.github ?? null;
		case "gitlab":
			return gitProviderConfig.gitlab ?? null;
		case "bitbucket":
			return gitProviderConfig.bitbucket ?? null;
		default:
			return null;
	}
}

function isProviderConfigured(providerType: GitProviderType): boolean {
	if (providerType === "none") {
		return false;
	}

	const providerConfig = getProviderConfig(providerType);

	if (!providerConfig) {
		return false;
	}

	const hasOAuthToken =
		providerConfig.oauth?.accessToken !== undefined && providerConfig.oauth.accessToken.length > 0;
	const hasPatToken = providerConfig.token !== undefined && providerConfig.token.length > 0;

	return hasOAuthToken || hasPatToken;
}

export type ProviderFactory = (remoteInfo: RemoteInfo, config: GitProviderConfig) => GitProvider;

const providerRegistry = new Map<GitProviderType, ProviderFactory>();

export function registerProvider(type: GitProviderType, factory: ProviderFactory): void {
	providerRegistry.set(type, factory);
}

export function unregisterProvider(type: GitProviderType): boolean {
	return providerRegistry.delete(type);
}

export function createGitProviderService(): GitProviderService {
	function detectProvider(remoteUrl: string): RemoteInfo {
		return parseRemoteUrl(remoteUrl);
	}

	function getProvider(remoteInfo: RemoteInfo): GitProvider | null {
		const { provider: providerType } = remoteInfo;

		if (providerType === "none") {
			return null;
		}

		const factory = providerRegistry.get(providerType);

		if (!factory) {
			return null;
		}

		const providerConfig = getProviderConfig(providerType);

		if (!providerConfig) {
			return null;
		}

		return factory(remoteInfo, providerConfig);
	}

	function getProviderForRemote(remoteUrl: string): GitProvider | null {
		const remoteInfo = detectProvider(remoteUrl);

		return getProvider(remoteInfo);
	}

	function getSupportedProviders(): GitProviderType[] {
		return Array.from(providerRegistry.keys());
	}

	return {
		detectProvider,
		getProvider,
		getProviderForRemote,
		isProviderConfigured,
		getSupportedProviders,
	};
}
