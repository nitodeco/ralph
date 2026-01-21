export { getGitRemoteUrl } from "./git.ts";
export { createProjectRegistryService } from "./implementation.ts";
export {
	buildFolderName,
	createGitProjectIdentifier,
	createPathProjectIdentifier,
	createProjectIdentifier,
	hashPath,
	normalizeGitRemote,
	sanitizeFolderName,
} from "./resolution.ts";
export type {
	ProjectIdentifier,
	ProjectIdType,
	ProjectMetadata,
	ProjectRegistry,
	ProjectRegistryService,
	RegisterProjectOptions,
} from "./types.ts";
export { REGISTRY_VERSION } from "./types.ts";
