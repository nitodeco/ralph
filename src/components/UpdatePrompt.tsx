import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import { useCallback, useEffect, useState } from "react";
import { loadConfig, saveConfig } from "@/lib/config.ts";
import {
	compareVersions,
	downloadBinary,
	fetchLatestVersion,
	getArchitecture,
	getOperatingSystem,
	getRemoveOldBinaryCommand,
	installWithMigration,
	type MigrationResult,
	restartApplication,
} from "@/lib/update.ts";
import { Message } from "./common/Message.tsx";
import { ProgressBar } from "./common/ProgressBar.tsx";
import { Spinner } from "./common/Spinner.tsx";
import { Header } from "./Header.tsx";

interface UpdatePromptProps {
	version: string;
	forceCheck?: boolean;
	onComplete?: () => void;
}

type UpdateState =
	| "checking"
	| "up_to_date"
	| "update_available"
	| "downloading"
	| "installing"
	| "complete"
	| "migrated"
	| "error";

type UpdateAction = "update" | "remind" | "skip";

const UPDATE_CHOICES = [
	{ label: "Update now", value: "update" as const },
	{ label: "Remind me later", value: "remind" as const },
	{ label: "Skip this version", value: "skip" as const },
];

function skipVersion(version: string): void {
	const config = loadConfig();

	config.skipVersion = version;
	saveConfig(config);
}

export function UpdatePrompt({
	version,
	forceCheck: _forceCheck = false,
	onComplete,
}: UpdatePromptProps): React.ReactElement {
	const { exit } = useApp();
	const [state, setState] = useState<UpdateState>("checking");

	const handleExit = useCallback(() => {
		if (onComplete) {
			onComplete();
		} else {
			exit();
		}
	}, [onComplete, exit]);
	const [latestVersion, setLatestVersion] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
	const [totalBytes, setTotalBytes] = useState<number>(0);
	const [updatePerformed, setUpdatePerformed] = useState<boolean>(false);
	const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

	useEffect(() => {
		const checkForUpdates = async () => {
			try {
				const latest = await fetchLatestVersion();

				setLatestVersion(latest);

				const config = loadConfig();

				config.lastUpdateCheck = Date.now();
				saveConfig(config);

				const comparison = compareVersions(version, latest);

				if (comparison <= 0) {
					const currentConfig = loadConfig();

					currentConfig.skipVersion = undefined;

					saveConfig(currentConfig);
					setState("up_to_date");
				} else {
					setState("update_available");
				}
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err);

				setError(errorMessage);
				setState("error");
			}
		};

		checkForUpdates();
	}, [version]);

	const handleUpdateAction = async (item: { value: UpdateAction }) => {
		switch (item.value) {
			case "update":
				await performUpdate();

				break;
			case "skip":
				if (latestVersion) {
					skipVersion(latestVersion);
				}

				setState("complete");

				break;
			case "remind":
				setState("complete");

				break;
		}
	};

	const performUpdate = async () => {
		if (!latestVersion) {
			return;
		}

		try {
			setState("downloading");
			const operatingSystem = getOperatingSystem();
			const architecture = getArchitecture();

			const handleProgress = (downloaded: number, total: number) => {
				setDownloadedBytes(downloaded);
				setTotalBytes(total);
			};

			const binaryData = await downloadBinary(
				latestVersion,
				operatingSystem,
				architecture,
				handleProgress,
			);

			setState("installing");
			const result = await installWithMigration(binaryData);

			setMigrationResult(result);

			setUpdatePerformed(true);

			if (result.migrated) {
				setState("migrated");
			} else {
				setState("complete");
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);

			setError(errorMessage);
			setState("error");
		}
	};

	useEffect(() => {
		if (state === "complete" || state === "up_to_date" || state === "error") {
			const timeout = setTimeout(() => {
				if (state === "complete" && updatePerformed && migrationResult) {
					restartApplication(migrationResult.newPath);
				} else if (state === "complete" && updatePerformed) {
					restartApplication();
				} else {
					handleExit();
				}
			}, 2000);

			return () => clearTimeout(timeout);
		}
	}, [state, handleExit, updatePerformed, migrationResult]);

	const renderContent = () => {
		switch (state) {
			case "checking":
				return <Spinner label="Checking for updates..." />;

			case "up_to_date":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">Ralph is up to date!</Message>
						<Text dimColor>Current version: {version}</Text>
					</Box>
				);

			case "update_available":
				return (
					<Box flexDirection="column" gap={1}>
						<Box flexDirection="column">
							<Text>
								A new version of Ralph is available:{" "}
								<Text color="green" bold>
									{latestVersion}
								</Text>
							</Text>
							<Text dimColor>Current version: {version}</Text>
						</Box>
						<Box marginTop={1} flexDirection="column">
							<Text color="cyan">Would you like to update?</Text>
							<SelectInput items={UPDATE_CHOICES} onSelect={handleUpdateAction} />
						</Box>
					</Box>
				);

			case "downloading":
				return (
					<Box flexDirection="column" gap={1}>
						<Spinner label={`Downloading ${latestVersion}...`} />
						<ProgressBar
							current={downloadedBytes}
							total={totalBytes}
							label={`ralph-${getOperatingSystem()}-${getArchitecture()}`}
						/>
					</Box>
				);

			case "installing":
				return <Spinner label="Installing..." />;

			case "migrated":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="success">Ralph updated successfully to {latestVersion}!</Message>
						<Box flexDirection="column" marginTop={1}>
							<Text color="yellow" bold>
								Installation location has changed
							</Text>
							<Text>Ralph has been moved to: {migrationResult?.newPath}</Text>
						</Box>
						{migrationResult?.shellConfigPath && (
							<Box flexDirection="column" marginTop={1}>
								<Text>PATH has been updated in: {migrationResult.shellConfigPath}</Text>
								<Text dimColor>
									Restart your terminal or run: source {migrationResult.shellConfigPath}
								</Text>
							</Box>
						)}
						{migrationResult?.oldPath && (
							<Box flexDirection="column" marginTop={1}>
								<Text color="yellow">Please remove the old installation:</Text>
								<Box marginTop={1}>
									<Text color="cyan" bold>
										{getRemoveOldBinaryCommand(migrationResult.oldPath)}
									</Text>
								</Box>
							</Box>
						)}
						<Box marginTop={1}>
							<Text dimColor>Press Ctrl+C to exit, then restart your terminal.</Text>
						</Box>
					</Box>
				);

			case "complete":
				return (
					<Box flexDirection="column" gap={1}>
						{updatePerformed ? (
							<>
								<Message type="success">Ralph updated successfully to {latestVersion}!</Message>
								<Text dimColor>Restarting...</Text>
							</>
						) : (
							<Text dimColor>You can update later by running 'ralph update'.</Text>
						)}
					</Box>
				);

			case "error":
				return (
					<Box flexDirection="column" gap={1}>
						<Message type="error">Update failed</Message>
						{error && <Text dimColor>{error}</Text>}
					</Box>
				);

			default:
				return null;
		}
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				{renderContent()}
			</Box>
		</Box>
	);
}
