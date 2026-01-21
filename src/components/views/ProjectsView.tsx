import { existsSync } from "node:fs";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { getProjectRegistryService } from "@/lib/services/index.ts";
import type { ProjectMetadata } from "@/lib/services/project-registry/types.ts";
import { Header } from "../Header.tsx";

interface ProjectsViewProps {
	version: string;
	onClose: () => void;
}

type ViewMode = "list" | "detail" | "confirm-prune";

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

function isCurrentProject(project: ProjectMetadata): boolean {
	const cwd = process.cwd();

	return project.lastKnownPath === cwd;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ version, onClose }) => {
	const projectRegistry = getProjectRegistryService();
	const [projects, setProjects] = useState(() => projectRegistry.listProjects());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const orphanedProjects = projects.filter((p) => !existsSync(p.lastKnownPath));
	const hasOrphanedProjects = orphanedProjects.length > 0;

	useInput((input, key) => {
		if (viewMode === "confirm-prune") {
			if (key.return) {
				for (const project of orphanedProjects) {
					projectRegistry.removeProject(project.identifier);
				}

				setProjects(projectRegistry.listProjects());
				setMessage({
					type: "success",
					text: `Removed ${orphanedProjects.length} orphaned project${orphanedProjects.length === 1 ? "" : "s"}`,
				});
				setViewMode("list");
				setSelectedIndex(0);
				setTimeout(() => setMessage(null), 3000);

				return;
			}

			if (key.escape) {
				setViewMode("list");

				return;
			}

			return;
		}

		if (viewMode === "detail") {
			if (key.escape || input === "q") {
				setViewMode("list");

				return;
			}

			return;
		}

		if (key.escape || input === "q") {
			onClose();

			return;
		}

		if (key.upArrow || input === "k") {
			setSelectedIndex((prev) => (prev > 0 ? prev - 1 : projects.length - 1));

			return;
		}

		if (key.downArrow || input === "j") {
			setSelectedIndex((prev) => (prev < projects.length - 1 ? prev + 1 : 0));

			return;
		}

		if (key.return && projects.length > 0) {
			setViewMode("detail");

			return;
		}

		if (input === "p" && hasOrphanedProjects) {
			setViewMode("confirm-prune");

			return;
		}

		if (input === "x" && projects.length > 0) {
			const maybeSelectedProject = projects[selectedIndex];

			if (maybeSelectedProject) {
				projectRegistry.removeProject(maybeSelectedProject.identifier);
				const updatedProjects = projectRegistry.listProjects();

				setProjects(updatedProjects);
				setSelectedIndex((prev) => Math.min(prev, Math.max(0, updatedProjects.length - 1)));
				setMessage({
					type: "success",
					text: `Removed project: ${maybeSelectedProject.displayName}`,
				});
				setTimeout(() => setMessage(null), 3000);
			}

			return;
		}
	});

	const maybeSelectedProject = projects[selectedIndex];

	if (viewMode === "confirm-prune") {
		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} />

				<Box
					flexDirection="column"
					marginTop={1}
					borderStyle="round"
					borderColor="red"
					paddingX={1}
					paddingY={1}
				>
					<Text bold color="red">
						Prune Orphaned Projects
					</Text>
					<Text>
						This will remove {orphanedProjects.length} project
						{orphanedProjects.length === 1 ? "" : "s"} with invalid paths:
					</Text>
					<Box flexDirection="column" marginTop={1}>
						{orphanedProjects.map((project) => (
							<Text key={project.identifier.folderName} dimColor>
								• {project.displayName} ({truncatePath(project.lastKnownPath, 40)})
							</Text>
						))}
					</Box>
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text color="yellow">Press Enter to confirm, Escape to cancel</Text>
				</Box>
			</Box>
		);
	}

	if (viewMode === "detail" && maybeSelectedProject) {
		const projectDir = projectRegistry.getProjectDir(maybeSelectedProject.identifier);
		const pathExists = existsSync(maybeSelectedProject.lastKnownPath);

		return (
			<Box flexDirection="column" padding={1}>
				<Header version={version} />

				<Box flexDirection="column" marginTop={1}>
					<Text bold color="cyan">
						Project Details
					</Text>
				</Box>

				<Box
					flexDirection="column"
					marginTop={1}
					borderStyle="round"
					borderColor="gray"
					paddingX={1}
					paddingY={1}
				>
					<Box>
						<Text bold>Name: </Text>
						<Text>{maybeSelectedProject.displayName}</Text>
					</Box>
					<Box>
						<Text bold>Path: </Text>
						<Text color={pathExists ? undefined : "red"}>
							{maybeSelectedProject.lastKnownPath}
							{!pathExists && " (not found)"}
						</Text>
					</Box>
					<Box>
						<Text bold>Type: </Text>
						<Text>{maybeSelectedProject.identifier.type}</Text>
					</Box>
					<Box>
						<Text bold>Folder: </Text>
						<Text>{maybeSelectedProject.identifier.folderName}</Text>
					</Box>
					<Box>
						<Text bold>Created: </Text>
						<Text>{formatDateFull(maybeSelectedProject.createdAt)}</Text>
					</Box>
					<Box>
						<Text bold>Last Used: </Text>
						<Text>{formatDateFull(maybeSelectedProject.lastAccessedAt)}</Text>
					</Box>
					{maybeSelectedProject.gitRemote && (
						<Box>
							<Text bold>Git Remote: </Text>
							<Text>{maybeSelectedProject.gitRemote}</Text>
						</Box>
					)}
					{projectDir && (
						<Box>
							<Text bold>Storage: </Text>
							<Text>{projectDir}</Text>
						</Box>
					)}
				</Box>

				<Box marginTop={1} flexDirection="column">
					<Text dimColor>Press q or Escape to go back</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />

			<Box flexDirection="column" marginTop={1}>
				<Text bold color="cyan">
					Registered Projects ({projects.length})
				</Text>
				{hasOrphanedProjects && (
					<Text color="yellow">
						{orphanedProjects.length} orphaned project{orphanedProjects.length === 1 ? "" : "s"}{" "}
						found (press p to prune)
					</Text>
				)}
			</Box>

			<Box
				flexDirection="column"
				marginTop={1}
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				paddingY={1}
				minHeight={10}
			>
				{projects.length === 0 ? (
					<Text dimColor>No registered projects. Run 'ralph init' in a project directory.</Text>
				) : (
					projects.map((project, index) => {
						const isSelected = index === selectedIndex;
						const isCurrent = isCurrentProject(project);
						const pathExists = existsSync(project.lastKnownPath);

						return (
							<Box key={project.identifier.folderName} gap={1}>
								<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
									{isSelected ? "▸" : " "}
								</Text>
								<Box width={24}>
									<Text
										color={isSelected ? "cyan" : pathExists ? undefined : "red"}
										bold={isSelected}
									>
										{project.displayName.slice(0, 22)}
										{isCurrent && (
											<Text color="green" bold>
												{" "}
												*
											</Text>
										)}
									</Text>
								</Box>
								<Box width={35}>
									<Text dimColor={!isSelected} color={pathExists ? undefined : "red"}>
										{truncatePath(project.lastKnownPath, 33)}
									</Text>
								</Box>
								<Box width={8}>
									<Text dimColor={!isSelected}>{project.identifier.type}</Text>
								</Box>
								<Text dimColor={!isSelected}>{formatRelativeTime(project.lastAccessedAt)}</Text>
							</Box>
						);
					})
				)}
			</Box>

			{message && (
				<Box marginTop={1}>
					<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
				</Box>
			)}

			<Box marginTop={1} flexDirection="column">
				<Text dimColor>Press q or Escape to close</Text>
				<Text dimColor>Use ↑/↓ or j/k to navigate, Enter to view details</Text>
				<Text dimColor>
					Press x to remove selected project{hasOrphanedProjects && ", p to prune orphaned"}
				</Text>
			</Box>
		</Box>
	);
};
