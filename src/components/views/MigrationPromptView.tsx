import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
	hasLocalRalphDir,
	type MigrationResult,
	migrateLocalRalphDir,
	needsProjectMigration,
	removeLocalRalphDir,
} from "@/lib/services/project-registry/migration.ts";
import type { RalphConfig } from "@/types.ts";
import { Message } from "../common/Message.tsx";
import { Spinner } from "../common/Spinner.tsx";
import { Header } from "../Header.tsx";

interface MigrationPromptViewProps {
	version: string;
	config: RalphConfig | null;
	projectName?: string;
	onMigrationComplete: () => void;
	onSkip: () => void;
}

type MigrationPhase = "prompt" | "migrating" | "cleanup_prompt" | "cleanup" | "success" | "error";

export function MigrationPromptView({
	version,
	config,
	projectName,
	onMigrationComplete,
	onSkip,
}: MigrationPromptViewProps): React.ReactElement {
	const [phase, setPhase] = useState<MigrationPhase>("prompt");
	const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
	const [localDeleted, setLocalDeleted] = useState(false);
	const [isAlreadyMigrated, setIsAlreadyMigrated] = useState(false);

	useEffect(() => {
		if (hasLocalRalphDir() && !needsProjectMigration()) {
			setIsAlreadyMigrated(true);
			setPhase("cleanup_prompt");
		}
	}, []);

	const handleMigrate = () => {
		setPhase("migrating");

		setTimeout(() => {
			const result = migrateLocalRalphDir();

			setMigrationResult(result);

			if (result.success) {
				const deleted = removeLocalRalphDir();

				setLocalDeleted(deleted);
				setPhase("success");
			} else {
				setPhase("error");
			}
		}, 100);
	};

	const handleCleanup = () => {
		setPhase("cleanup");

		setTimeout(() => {
			const deleted = removeLocalRalphDir();

			setLocalDeleted(deleted);
			setPhase("success");
		}, 100);
	};

	useInput((input, key) => {
		if (phase === "prompt") {
			if (input.toLowerCase() === "y" || key.return) {
				handleMigrate();
			} else if (input.toLowerCase() === "n" || key.escape) {
				onSkip();
			}
		} else if (phase === "cleanup_prompt") {
			if (input.toLowerCase() === "y" || key.return) {
				handleCleanup();
			} else if (input.toLowerCase() === "n" || key.escape) {
				onSkip();
			}
		} else if (phase === "success" || phase === "error") {
			if (key.return || key.escape) {
				onMigrationComplete();
			}
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} agent={config?.agent} projectName={projectName} />
			<Box flexDirection="column" marginY={1} paddingX={1} gap={1}>
				{phase === "prompt" && (
					<>
						<Message type="info">Local .ralph directory detected</Message>
						<Box flexDirection="column" paddingLeft={2}>
							<Text>Ralph now stores project data in a global directory (~/.ralph/projects/).</Text>
							<Text>This allows you to access your project data from any directory.</Text>
						</Box>
						<Box marginTop={1}>
							<Text>Would you like to migrate your local .ralph directory to global storage?</Text>
						</Box>
						<Box marginTop={1}>
							<Text>
								Press <Text color="green">Y</Text> to migrate or <Text color="yellow">N</Text> to
								skip
							</Text>
						</Box>
					</>
				)}

				{phase === "cleanup_prompt" && (
					<>
						<Message type="info">Project already migrated</Message>
						<Box flexDirection="column" paddingLeft={2}>
							<Text>This project is already registered in global storage.</Text>
							<Text>However, a local .ralph directory still exists in this repository.</Text>
						</Box>
						<Box marginTop={1}>
							<Text>Would you like to delete the local .ralph directory?</Text>
						</Box>
						<Box marginTop={1}>
							<Text>
								Press <Text color="green">Y</Text> to delete or <Text color="yellow">N</Text> to
								keep
							</Text>
						</Box>
					</>
				)}

				{phase === "migrating" && (
					<Box gap={1}>
						<Spinner />
						<Text>Migrating project data...</Text>
					</Box>
				)}

				{phase === "cleanup" && (
					<Box gap={1}>
						<Spinner />
						<Text>Removing local .ralph directory...</Text>
					</Box>
				)}

				{phase === "success" && !isAlreadyMigrated && migrationResult?.success && (
					<>
						<Message type="success">Migration complete!</Message>
						<Box flexDirection="column" paddingLeft={2}>
							<Text>
								<Text dimColor>Project:</Text>{" "}
								<Text color="cyan">{migrationResult.identifier?.folderName}</Text>
							</Text>
							<Text>
								<Text dimColor>Destination:</Text>{" "}
								<Text color="cyan">{migrationResult.destinationPath}</Text>
							</Text>
							{migrationResult.migratedFiles.length > 0 && (
								<Box flexDirection="column" marginTop={1}>
									<Text dimColor>Migrated files:</Text>
									{migrationResult.migratedFiles.map((file) => (
										<Text key={file} dimColor>
											{"  "}- {file}
										</Text>
									))}
								</Box>
							)}
							<Box marginTop={1}>
								{localDeleted ? (
									<Text color="green">Local .ralph directory deleted.</Text>
								) : (
									<Text color="yellow">Failed to delete local .ralph directory.</Text>
								)}
							</Box>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Press Enter to continue...</Text>
						</Box>
					</>
				)}

				{phase === "success" && isAlreadyMigrated && (
					<>
						<Message type="success">Cleanup complete!</Message>
						<Box flexDirection="column" paddingLeft={2}>
							{localDeleted ? (
								<Text color="green">Local .ralph directory deleted.</Text>
							) : (
								<Text color="yellow">Failed to delete local .ralph directory.</Text>
							)}
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Press Enter to continue...</Text>
						</Box>
					</>
				)}

				{phase === "error" && (
					<>
						<Message type="error">Migration failed</Message>
						{migrationResult?.errors && migrationResult.errors.length > 0 && (
							<Box flexDirection="column" paddingLeft={2}>
								{migrationResult.errors.map((error) => (
									<Text key={error} color="red">
										• {error}
									</Text>
								))}
							</Box>
						)}
						<Box marginTop={1}>
							<Text dimColor>Press Enter to continue without migration...</Text>
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
}
