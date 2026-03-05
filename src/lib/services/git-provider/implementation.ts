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
    hostnames: ["github.com"],
    httpsPattern: /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
    sshPattern: /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/,
    type: "github",
  },
  {
    hostnames: ["gitlab.com"],
    httpsPattern: /^https?:\/\/gitlab\.com\/([^/]+)\/(.+?)(?:\.git)?$/,
    sshPattern: /^git@gitlab\.com:([^/]+)\/(.+?)(?:\.git)?$/,
    type: "gitlab",
  },
  {
    hostnames: ["bitbucket.org"],
    httpsPattern: /^https?:\/\/bitbucket\.org\/([^/]+)\/(.+?)(?:\.git)?$/,
    sshPattern: /^git@bitbucket\.org:([^/]+)\/(.+?)(?:\.git)?$/,
    type: "bitbucket",
  },
];

function parseRemoteUrl(remoteUrl: string): RemoteInfo {
  const trimmedUrl = remoteUrl.trim();

  for (const pattern of PROVIDER_PATTERNS) {
    const sshMatch = trimmedUrl.match(pattern.sshPattern);

    if (sshMatch) {
      const [, owner, repo] = sshMatch;

      return {
        hostname: pattern.hostnames.at(0) ?? "",
        owner: owner ?? "",
        provider: pattern.type,
        repo: repo?.replace(/\.git$/, "") ?? "",
      };
    }

    const httpsMatch = trimmedUrl.match(pattern.httpsPattern);

    if (httpsMatch) {
      const [, owner, repo] = httpsMatch;

      return {
        hostname: pattern.hostnames.at(0) ?? "",
        owner: owner ?? "",
        provider: pattern.type,
        repo: repo?.replace(/\.git$/, "") ?? "",
      };
    }
  }

  return {
    hostname: extractHostname(trimmedUrl),
    owner: "",
    provider: "none",
    repo: "",
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
    case "github": {
      return gitProviderConfig.github ?? null;
    }

    case "gitlab": {
      return gitProviderConfig.gitlab ?? null;
    }

    case "bitbucket": {
      return gitProviderConfig.bitbucket ?? null;
    }

    default: {
      return null;
    }
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
    return [...providerRegistry.keys()];
  }

  return {
    detectProvider,
    getProvider,
    getProviderForRemote,
    getSupportedProviders,
    isProviderConfigured,
  };
}
