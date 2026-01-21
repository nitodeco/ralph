import { existsSync } from "node:fs";
import { getProjectRegistryService } from "@/lib/services/index.ts";
import type { ProjectMetadata } from "@/lib/services/project-registry/types.ts";

interface ProjectListOutput {
	projects: Array<{
		name: string;
		path: string;
		type: string;
		lastAccessed: string;
		gitRemote?: string;
	}>;
	total: number;
}

interface CurrentProjectOutput {
	initialized: boolean;
	name?: string;
	path?: string;
	type?: string;
	folderName?: string;
	createdAt?: string;
	lastAccessed?: string;
	gitRemote?: string;
	storagePath?: string;
}

interface PruneOutput {
	removed: string[];
	count: number;
}

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diffInMs = now - timestamp;
	const diffInMinutes = Math.floor(diffInMs / 60_000);
	const diffInHours = Math.floor(diffInMs / 3_600_000);
	const diffInDays = Math.floor(diffInMs / 86_400_000);

	if (diffInMinutes < 1) {
		return "just now";
	}

	if (diffInMinutes < 60) {
		return `${diffInMinutes}m ago`;
	}

	if (diffInHours < 24) {
		return `${diffInHours}h ago`;
	}

	if (diffInDays < 30) {
		return `${diffInDays}d ago`;
	}

	return new Date(timestamp).toLocaleDateString();
}

function formatDateFull(timestamp: number): string {
	return new Date(timestamp).toLocaleString();
}

function truncatePath(path: string, maxLength: number): string {
	if (path.length <= maxLength) {
		return path;
	}

	const homeDir = process.env.HOME ?? "";

	if (homeDir && path.startsWith(homeDir)) {
		const shortened = `~${path.slice(homeDir.length)}`;

		if (shortened.length <= maxLength) {
			return shortened;
		}
	}

	return `...${path.slice(-(maxLength - 3))}`;
}

export function printProjects(version: string, json: boolean): void {
	const projectRegistry = getProjectRegistryService();
	const projects = projectRegistry.listProjects();

	if (json) {
		const output: ProjectListOutput = {
			projects: projects.map((project) => ({
				name: project.displayName,
				path: project.lastKnownPath,
				type: project.identifier.type,
				lastAccessed: new Date(project.lastAccessedAt).toISOString(),
				gitRemote: project.gitRemote,
			})),
			total: projects.length,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(`\n◆ ralph v${version} - Projects\n`);

	if (projects.length === 0) {
		console.log("No registered projects found.");
		console.log("\nRun 'ralph init' in a project directory to get started.");

		return;
	}

	console.log(`Found ${projects.length} registered project${projects.length === 1 ? "" : "s"}:\n`);

	const nameWidth = 25;
	const pathWidth = 40;
	const typeWidth = 6;
	const timeWidth = 12;

	console.log(
		`${"Name".padEnd(nameWidth)} ${"Path".padEnd(pathWidth)} ${"Type".padEnd(typeWidth)} ${"Last Used".padEnd(timeWidth)}`,
	);
	console.log("-".repeat(nameWidth + pathWidth + typeWidth + timeWidth + 3));

	for (const project of projects) {
		const name = project.displayName.slice(0, nameWidth).padEnd(nameWidth);
		const path = truncatePath(project.lastKnownPath, pathWidth).padEnd(pathWidth);
		const type = project.identifier.type.padEnd(typeWidth);
		const time = formatRelativeTime(project.lastAccessedAt).padEnd(timeWidth);

		console.log(`${name} ${path} ${type} ${time}`);
	}

	console.log();
}

export function printCurrentProject(json: boolean): void {
	const projectRegistry = getProjectRegistryService();
	const cwd = process.cwd();
	const maybeIdentifier = projectRegistry.resolveCurrentProject(cwd);

	if (!maybeIdentifier) {
		if (json) {
			const output: CurrentProjectOutput = { initialized: false };

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log("Not a Ralph project.");
			console.log("\nRun 'ralph init' to initialize this directory as a Ralph project.");
		}

		return;
	}

	const maybeMetadata = projectRegistry.getProjectMetadata(maybeIdentifier);
	const projectDir = projectRegistry.getProjectDir(maybeIdentifier);

	if (json) {
		const output: CurrentProjectOutput = {
			initialized: true,
			name: maybeMetadata?.displayName ?? maybeIdentifier.folderName,
			path: maybeMetadata?.lastKnownPath ?? cwd,
			type: maybeIdentifier.type,
			folderName: maybeIdentifier.folderName,
			createdAt: maybeMetadata ? new Date(maybeMetadata.createdAt).toISOString() : undefined,
			lastAccessed: maybeMetadata
				? new Date(maybeMetadata.lastAccessedAt).toISOString()
				: undefined,
			gitRemote: maybeMetadata?.gitRemote,
			storagePath: projectDir ?? undefined,
		};

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log("\n◆ Current Project\n");
	console.log(`  Name:         ${maybeMetadata?.displayName ?? maybeIdentifier.folderName}`);
	console.log(`  Path:         ${maybeMetadata?.lastKnownPath ?? cwd}`);
	console.log(`  Type:         ${maybeIdentifier.type}`);
	console.log(`  Folder:       ${maybeIdentifier.folderName}`);

	if (maybeMetadata) {
		console.log(`  Created:      ${formatDateFull(maybeMetadata.createdAt)}`);
		console.log(`  Last Accessed: ${formatDateFull(maybeMetadata.lastAccessedAt)}`);
	}

	if (maybeMetadata?.gitRemote) {
		console.log(`  Git Remote:   ${maybeMetadata.gitRemote}`);
	}

	if (projectDir) {
		console.log(`  Storage:      ${projectDir}`);
	}

	console.log();
}

export function handleProjectsPrune(json: boolean): void {
	const projectRegistry = getProjectRegistryService();
	const projects = projectRegistry.listProjects();

	const orphanedProjects: ProjectMetadata[] = [];

	for (const project of projects) {
		if (!existsSync(project.lastKnownPath)) {
			orphanedProjects.push(project);
		}
	}

	if (orphanedProjects.length === 0) {
		if (json) {
			const output: PruneOutput = { removed: [], count: 0 };

			console.log(JSON.stringify(output, null, 2));
		} else {
			console.log("No orphaned projects found. All registered projects have valid paths.");
		}

		return;
	}

	const removedNames: string[] = [];

	for (const project of orphanedProjects) {
		const isRemoved = projectRegistry.removeProject(project.identifier);

		if (isRemoved) {
			removedNames.push(project.displayName);
		}
	}

	if (json) {
		const output: PruneOutput = { removed: removedNames, count: removedNames.length };

		console.log(JSON.stringify(output, null, 2));

		return;
	}

	console.log(
		`Removed ${removedNames.length} orphaned project${removedNames.length === 1 ? "" : "s"}:\n`,
	);

	for (const name of removedNames) {
		console.log(`  • ${name}`);
	}

	console.log();
}
