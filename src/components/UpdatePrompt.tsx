import { Box, Text, useApp } from "ink";
import SelectInput from "ink-select-input";
import { useEffect, useState } from "react";
import { loadConfig, saveConfig } from "../lib/config.ts";
import {
	compareVersions,
	downloadBinary,
	fetchLatestVersion,
	getArchitecture,
	getBinaryPath,
	getOperatingSystem,
	installBinary,
} from "../lib/update.ts";
import { Header } from "./Header.tsx";
import { Message } from "./common/Message.tsx";
import { ProgressBar } from "./common/ProgressBar.tsx";
import { Spinner } from "./common/Spinner.tsx";

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
	forceCheck = false,
	onComplete,
}: UpdatePromptProps): React.ReactElement {
	const { exit } = useApp();
	const [state, setState] = useState<UpdateState>("checking");

	const handleExit = () => {
		if (onComplete) {
			onComplete();
		} else {
			exit();
		}
	};
	const [latestVersion, setLatestVersion] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
	const [totalBytes, setTotalBytes] = useState<number>(0);

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
	}, [version, forceCheck]);

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
		if (!latestVersion) return;

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
			const targetPath = getBinaryPath();
			await installBinary(binaryData, targetPath);

			setState("complete");
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			setError(errorMessage);
			setState("error");
		}
	};

	useEffect(() => {
		if (state === "complete" || state === "up_to_date" || state === "error") {
			const timeout = setTimeout(() => {
				handleExit();
			}, 2000);
			return () => clearTimeout(timeout);
		}
	}, [state]);

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

			case "complete":
				return (
					<Box flexDirection="column" gap={1}>
						{latestVersion && state === "complete" ? (
							<Message type="success">
								Ralph updated successfully to {latestVersion}!
							</Message>
						) : (
							<Text dimColor>
								You can update later by running 'ralph update'.
							</Text>
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
