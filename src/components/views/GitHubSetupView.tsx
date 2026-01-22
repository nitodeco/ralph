import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { match } from "ts-pattern";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { invalidateConfigCache, loadGlobalConfig, saveGlobalConfig } from "@/lib/config.ts";
import { TRANSITION_DELAY_MS } from "@/lib/constants/ui.ts";

interface GitHubSetupViewProps {
	version: string;
	onClose: () => void;
}

type GitHubSetupStep = "menu" | "token" | "auto_pr" | "pr_draft" | "complete";

interface GitHubSetupState {
	step: GitHubSetupStep;
	token: string;
	autoCreatePr: boolean;
	prDraft: boolean;
	message: { type: "success" | "error"; text: string } | null;
}

const MENU_CHOICES = [
	{ label: "Set GitHub Token", value: "token" as const },
	{ label: "Toggle Auto-Create PR", value: "auto_pr" as const },
	{ label: "Toggle PR Draft Mode", value: "pr_draft" as const },
	{ label: "Clear GitHub Token", value: "clear" as const },
	{ label: "Cancel", value: "cancel" as const },
];

const YES_NO_CHOICES = [
	{ label: "Yes", value: true },
	{ label: "No", value: false },
];

function GitHubSetupHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - GitHub Integration
			</Text>
		</Box>
	);
}

function GitHubSetupFooter({ step }: { step: GitHubSetupStep }): React.ReactElement {
	const footerText = step === "menu" ? "Press Escape or 'q' to close" : "Press Escape to go back";

	return (
		<Box paddingX={1}>
			<Text dimColor>{footerText}</Text>
		</Box>
	);
}

function maskToken(token: string): string {
	if (token.length <= 8) {
		return "****";
	}

	const firstFour = token.slice(0, 4);
	const lastFour = token.slice(-4);

	return `${firstFour}...${lastFour}`;
}

export function GitHubSetupView({ version, onClose }: GitHubSetupViewProps): React.ReactElement {
	const globalConfig = loadGlobalConfig();
	const gitProvider = globalConfig.gitProvider;
	const existingToken = gitProvider?.github?.token;

	const [state, setState] = useState<GitHubSetupState>({
		step: "menu",
		token: "",
		autoCreatePr: gitProvider?.autoCreatePr ?? false,
		prDraft: gitProvider?.prDraft ?? true,
		message: null,
	});

	useInput((input, key) => {
		if (state.step === "menu" && (key.escape || input === "q")) {
			onClose();
		} else if (state.step !== "menu" && state.step !== "complete" && key.escape) {
			setState((prev) => ({ ...prev, step: "menu", message: null }));
		}
	});

	const saveAndClose = (message: string) => {
		setState((prev) => ({
			...prev,
			step: "complete",
			message: { type: "success", text: message },
		}));
		setTimeout(() => onClose(), TRANSITION_DELAY_MS);
	};

	const handleMenuSelect = (item: { value: string }) => {
		match(item.value)
			.with("token", () => {
				setState((prev) => ({ ...prev, step: "token", message: null }));
			})
			.with("auto_pr", () => {
				setState((prev) => ({ ...prev, step: "auto_pr", message: null }));
			})
			.with("pr_draft", () => {
				setState((prev) => ({ ...prev, step: "pr_draft", message: null }));
			})
			.with("clear", () => {
				const updatedConfig = {
					...globalConfig,
					gitProvider: {
						...globalConfig.gitProvider,
						github: { ...globalConfig.gitProvider?.github, token: undefined },
					},
				};

				saveGlobalConfig(updatedConfig);
				invalidateConfigCache();
				saveAndClose("GitHub token cleared");
			})
			.with("cancel", () => {
				onClose();
			})
			.otherwise(() => {});
	};

	const handleTokenSubmit = () => {
		const trimmedToken = state.token.trim();

		if (!trimmedToken) {
			setState((prev) => ({
				...prev,
				message: { type: "error", text: "Token cannot be empty" },
			}));

			return;
		}

		const updatedConfig = {
			...globalConfig,
			gitProvider: {
				...globalConfig.gitProvider,
				github: { ...globalConfig.gitProvider?.github, token: trimmedToken },
			},
		};

		saveGlobalConfig(updatedConfig);
		invalidateConfigCache();
		saveAndClose("GitHub token saved successfully");
	};

	const handleAutoCreatePrSelect = (item: { value: boolean }) => {
		const updatedConfig = {
			...globalConfig,
			gitProvider: {
				...globalConfig.gitProvider,
				autoCreatePr: item.value,
			},
		};

		saveGlobalConfig(updatedConfig);
		invalidateConfigCache();
		saveAndClose(`Auto-create PR ${item.value ? "enabled" : "disabled"}`);
	};

	const handlePrDraftSelect = (item: { value: boolean }) => {
		const updatedConfig = {
			...globalConfig,
			gitProvider: {
				...globalConfig.gitProvider,
				prDraft: item.value,
			},
		};

		saveGlobalConfig(updatedConfig);
		invalidateConfigCache();
		saveAndClose(`PR draft mode ${item.value ? "enabled" : "disabled"}`);
	};

	const renderContent = () => {
		return match(state.step)
			.with("menu", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							GitHub Integration Settings
						</Text>
						<Text dimColor>
							Token: {existingToken ? maskToken(existingToken) : "not configured"}
						</Text>
						<Text dimColor>
							Auto-Create PR: {gitProvider?.autoCreatePr ? "enabled" : "disabled"}
						</Text>
						<Text dimColor>PR Draft Mode: {gitProvider?.prDraft ? "enabled" : "disabled"}</Text>
					</Box>

					<Box marginTop={1}>
						<SelectInput items={MENU_CHOICES} onSelect={handleMenuSelect} />
					</Box>
				</Box>
			))
			.with("token", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							Enter GitHub Personal Access Token
						</Text>
						<Text dimColor>Token requires 'repo' scope for PR operations.</Text>
						<Text dimColor>Create one at: https://github.com/settings/tokens</Text>
					</Box>

					<Box marginTop={1} gap={1}>
						<Text color="gray">Token:</Text>
						<TextInput
							value={state.token}
							onChange={(value) => setState((prev) => ({ ...prev, token: value }))}
							onSubmit={handleTokenSubmit}
							placeholder="ghp_xxxxxxxxxxxx"
							mask="*"
						/>
					</Box>

					<Text dimColor>Press Enter to save</Text>

					{state.message?.type === "error" && <Text color="red">{state.message.text}</Text>}
				</Box>
			))
			.with("auto_pr", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							Auto-Create Pull Requests
						</Text>
						<Text dimColor>Automatically create a PR when a task branch is complete.</Text>
						<Text dimColor>Current: {gitProvider?.autoCreatePr ? "enabled" : "disabled"}</Text>
					</Box>

					<Box marginTop={1}>
						<SelectInput
							items={YES_NO_CHOICES}
							initialIndex={gitProvider?.autoCreatePr ? 0 : 1}
							onSelect={handleAutoCreatePrSelect}
						/>
					</Box>
				</Box>
			))
			.with("pr_draft", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							PR Draft Mode
						</Text>
						<Text dimColor>Create pull requests as drafts by default.</Text>
						<Text dimColor>Current: {gitProvider?.prDraft ? "enabled" : "disabled"}</Text>
					</Box>

					<Box marginTop={1}>
						<SelectInput
							items={YES_NO_CHOICES}
							initialIndex={gitProvider?.prDraft !== false ? 0 : 1}
							onSelect={handlePrDraftSelect}
						/>
					</Box>
				</Box>
			))
			.with("complete", () => (
				<Box flexDirection="column" gap={1}>
					{state.message && (
						<Text color={state.message.type === "success" ? "green" : "red"}>
							{state.message.text}
						</Text>
					)}
				</Box>
			))
			.exhaustive();
	};

	return (
		<ResponsiveLayout
			header={<GitHubSetupHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1}>
						{renderContent()}
					</Box>
				</ScrollableContent>
			}
			footer={<GitHubSetupFooter step={state.step} />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
