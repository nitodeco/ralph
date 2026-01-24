import { exec } from "node:child_process";
import { platform } from "node:os";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { TRANSITION_DELAY_MS } from "@/lib/constants/ui.ts";
import type {
	DeviceCodeResponse,
	DeviceFlowPollResult,
} from "@/lib/services/github-oauth/index.ts";
import { createGitHubOAuthService } from "@/lib/services/github-oauth/index.ts";
import { getConfigService } from "@/lib/services/index.ts";

function openUrl(url: string): void {
	const os = platform();
	const command = match(os)
		.with("darwin", () => `open "${url}"`)
		.with("win32", () => `start "" "${url}"`)
		.otherwise(() => `xdg-open "${url}"`);

	exec(command);
}

function copyToClipboard(text: string): Promise<boolean> {
	return new Promise((resolve) => {
		const os = platform();
		const command = match(os)
			.with("darwin", () => "pbcopy")
			.with("win32", () => "clip")
			.otherwise(() => "xclip -selection clipboard");

		const child = exec(command, (error) => {
			resolve(!error);
		});

		child.stdin?.write(text);
		child.stdin?.end();
	});
}

function focusTerminal(): void {
	const os = platform();

	if (os === "darwin") {
		const terminalApp = (process.env.TERM_PROGRAM ?? "Terminal").replace(/\.app$/, "");

		exec(`osascript -e 'tell application "${terminalApp}" to activate'`);
	}
}

interface GitHubSetupViewProps {
	version: string;
	onClose: () => void;
}

type GitHubSetupStep = "menu" | "oauth" | "token" | "auto_pr" | "pr_draft" | "complete";

interface GitHubSetupState {
	step: GitHubSetupStep;
	token: string;
	autoCreatePr: boolean;
	prDraft: boolean;
	message: { type: "success" | "error" | "info"; text: string } | null;
	oauthDeviceCode: DeviceCodeResponse | null;
	codeCopied: boolean;
}

const MENU_CHOICES = [
	{ label: "Login with GitHub (OAuth)", value: "oauth" as const },
	{ label: "Set Personal Access Token (legacy)", value: "token" as const },
	{ label: "Toggle Auto-Create PR", value: "auto_pr" as const },
	{ label: "Toggle PR Draft Mode", value: "pr_draft" as const },
	{ label: "Logout / Clear credentials", value: "clear" as const },
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
	const footerText = match(step)
		.with("menu", () => "Press Escape or 'q' to close")
		.with("oauth", () => "'c' to copy code | Escape or 'q' to cancel")
		.otherwise(() => "Press Escape to go back");

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

const SLEEP_BUFFER_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GitHubSetupView({ version, onClose }: GitHubSetupViewProps): React.ReactElement {
	const configService = getConfigService();
	const globalConfig = configService.loadGlobal();
	const gitProvider = globalConfig.gitProvider;
	const existingToken = gitProvider?.github?.token;
	const existingOAuth = gitProvider?.github?.oauth;
	const hasOAuth = existingOAuth?.accessToken !== undefined;

	const [state, setState] = useState<GitHubSetupState>({
		step: "menu",
		token: "",
		autoCreatePr: gitProvider?.autoCreatePr ?? false,
		prDraft: gitProvider?.prDraft ?? true,
		message: null,
		oauthDeviceCode: null,
		codeCopied: false,
	});

	const isPollingRef = useRef(false);

	useInput((input, key) => {
		if (state.step === "menu" && (key.escape || input === "q")) {
			onClose();
		} else if (
			state.step !== "menu" &&
			state.step !== "complete" &&
			state.step !== "oauth" &&
			key.escape
		) {
			setState((prev) => ({ ...prev, step: "menu", message: null }));
		} else if (state.step === "oauth" && (key.escape || input === "q")) {
			isPollingRef.current = false;
			setState((prev) => ({
				...prev,
				step: "menu",
				message: { type: "info", text: "OAuth flow cancelled" },
				oauthDeviceCode: null,
				codeCopied: false,
			}));
		} else if (state.step === "oauth" && input === "c" && state.oauthDeviceCode?.userCode) {
			copyToClipboard(state.oauthDeviceCode.userCode).then((success) => {
				if (success) {
					setState((prev) => ({ ...prev, codeCopied: true }));
				}
			});
		}
	});

	useEffect(() => {
		if (state.step !== "oauth" || !state.oauthDeviceCode || isPollingRef.current) {
			return;
		}

		const oauthService = createGitHubOAuthService();
		const deviceCode = state.oauthDeviceCode;
		let isCancelled = false;

		isPollingRef.current = true;

		const pollForToken = async () => {
			const expiresAt = Date.now() + deviceCode.expiresInSeconds * 1_000;
			const pollIntervalMs = deviceCode.pollingIntervalSeconds * 1_000 + SLEEP_BUFFER_MS;

			while (Date.now() < expiresAt && !isCancelled) {
				await sleep(pollIntervalMs);

				if (isCancelled) {
					break;
				}

				let result: DeviceFlowPollResult;

				try {
					result = await oauthService.pollForAccessToken(
						deviceCode.deviceCode,
						deviceCode.pollingIntervalSeconds,
					);
				} catch {
					continue;
				}

				if (result.status === "success") {
					focusTerminal();
				}

				if (result.status === "success") {
					const currentConfig = configService.loadGlobal();
					const updatedConfig = {
						...currentConfig,
						gitProvider: {
							...currentConfig.gitProvider,
							github: {
								...currentConfig.gitProvider?.github,
								token: undefined,
								oauth: {
									accessToken: result.token.accessToken,
									tokenType: result.token.tokenType,
									scope: result.token.scope,
									createdAt: new Date().toISOString(),
									expiresAt: result.token.expiresAt,
									refreshToken: result.token.refreshToken,
									refreshTokenExpiresAt: result.token.refreshTokenExpiresAt,
								},
							},
						},
					};

					configService.saveGlobal(updatedConfig);
					configService.invalidateAll();

					isPollingRef.current = false;
					setState((prev) => ({
						...prev,
						step: "complete",
						message: { type: "success", text: "Successfully authenticated with GitHub!" },
					}));
					setTimeout(() => onClose(), TRANSITION_DELAY_MS);

					return;
				}

				if (result.status === "error") {
					isPollingRef.current = false;
					setState((prev) => ({
						...prev,
						step: "menu",
						message: { type: "error", text: `Authentication failed: ${result.error}` },
						oauthDeviceCode: null,
					}));

					return;
				}
			}

			if (!isCancelled) {
				isPollingRef.current = false;
				setState((prev) => ({
					...prev,
					step: "menu",
					message: { type: "error", text: "Authorization timed out. Please try again." },
					oauthDeviceCode: null,
				}));
			}
		};

		pollForToken();

		return () => {
			isCancelled = true;
			isPollingRef.current = false;
		};
	}, [
		state.step,
		state.oauthDeviceCode,
		onClose,
		configService.invalidateAll,
		configService.loadGlobal,
		configService.saveGlobal,
	]);

	const saveAndClose = (message: string) => {
		setState((prev) => ({
			...prev,
			step: "complete",
			message: { type: "success", text: message },
		}));
		setTimeout(() => onClose(), TRANSITION_DELAY_MS);
	};

	const startOAuthFlow = async () => {
		const oauthService = createGitHubOAuthService();

		try {
			const deviceCodeResponse = await oauthService.requestDeviceCode();

			const copied = await copyToClipboard(deviceCodeResponse.userCode);

			openUrl(deviceCodeResponse.verificationUri);

			setState((prev) => ({
				...prev,
				step: "oauth",
				oauthDeviceCode: deviceCodeResponse,
				message: null,
				codeCopied: copied,
			}));
		} catch (error) {
			setState((prev) => ({
				...prev,
				message: {
					type: "error",
					text: `Failed to start OAuth flow: ${error instanceof Error ? error.message : "Unknown error"}`,
				},
			}));
		}
	};

	const handleMenuSelect = (item: { value: string }) => {
		match(item.value)
			.with("oauth", () => {
				startOAuthFlow();
			})
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
						github: {
							...globalConfig.gitProvider?.github,
							token: undefined,
							oauth: undefined,
						},
					},
				};

				configService.saveGlobal(updatedConfig);
				configService.invalidateAll();
				saveAndClose("GitHub credentials cleared");
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

		configService.saveGlobal(updatedConfig);
		configService.invalidateAll();
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

		configService.saveGlobal(updatedConfig);
		configService.invalidateAll();
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

		configService.saveGlobal(updatedConfig);
		configService.invalidateAll();
		saveAndClose(`PR draft mode ${item.value ? "enabled" : "disabled"}`);
	};

	const getAuthStatus = (): string => {
		if (hasOAuth) {
			return "OAuth (authenticated)";
		}

		if (existingToken) {
			return `PAT: ${maskToken(existingToken)}`;
		}

		return "not configured";
	};

	const renderContent = () => {
		return match(state.step)
			.with("menu", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							GitHub Integration Settings
						</Text>
						<Text dimColor>Auth: {getAuthStatus()}</Text>
						<Text dimColor>
							Auto-Create PR: {gitProvider?.autoCreatePr ? "enabled" : "disabled"}
						</Text>
						<Text dimColor>PR Draft Mode: {gitProvider?.prDraft ? "enabled" : "disabled"}</Text>
					</Box>

					{state.message && (
						<Text color={state.message.type === "error" ? "red" : "green"}>
							{state.message.text}
						</Text>
					)}

					<Box marginTop={1}>
						<SelectInput items={MENU_CHOICES} onSelect={handleMenuSelect} />
					</Box>
				</Box>
			))
			.with("oauth", () => (
				<Box flexDirection="column" gap={1}>
					<Box flexDirection="column">
						<Text bold color="yellow">
							GitHub OAuth Login
						</Text>
						{state.oauthDeviceCode ? (
							<>
								<Text>Opening browser to:</Text>
								<Text color="cyan">{state.oauthDeviceCode.verificationUri}</Text>
								<Box marginTop={1}>
									<Text>Enter this code:</Text>
								</Box>
								<Box>
									<Text bold color="white">
										{state.oauthDeviceCode.userCode}
									</Text>
									{state.codeCopied && <Text color="green"> (copied)</Text>}
								</Box>
								<Box marginTop={1}>
									<Text dimColor>Waiting for authorization...</Text>
								</Box>
							</>
						) : (
							<Text dimColor>Initializing OAuth flow...</Text>
						)}
					</Box>

					{state.message?.type === "error" && <Text color="red">{state.message.text}</Text>}
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
