import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState } from "react";
import { acknowledgeWarning } from "@/lib/config.ts";
import { TextInput } from "./common/TextInput.tsx";
import { Header } from "./Header.tsx";

interface ConsentWarningProps {
	version: string;
	onAccept: () => void;
}

type ConsentStep = "warning" | "confirm";

const CONSENT_CHOICES = [
	{ label: "I understand the risks", value: "accept" as const },
	{ label: "Exit", value: "exit" as const },
];

export function ConsentWarning({ version, onAccept }: ConsentWarningProps): React.ReactElement {
	const { exit } = useApp();
	const [step, setStep] = useState<ConsentStep>("warning");
	const [confirmInput, setConfirmInput] = useState("");
	const [showError, setShowError] = useState(false);

	const handleSelect = (item: { value: "accept" | "exit" }) => {
		if (item.value === "exit") {
			exit();

			return;
		}

		setStep("confirm");
	};

	const handleConfirmSubmit = () => {
		if (confirmInput.trim().toLowerCase() === "i understand") {
			acknowledgeWarning();
			onAccept();

			return;
		}

		setShowError(true);
	};

	useInput((_, key) => {
		if (key.escape) {
			if (step === "confirm") {
				setStep("warning");
				setConfirmInput("");
				setShowError(false);
			} else {
				exit();
			}
		}
	});

	const renderWarning = (): React.ReactElement => (
		<Box flexDirection="column" gap={1}>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="yellow"
				paddingX={2}
				paddingY={1}
			>
				<Text bold color="yellow">
					Important Safety Warning
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text>
						Ralph orchestrates AI agents that can{" "}
						<Text bold color="red">
							execute code and modify files
						</Text>{" "}
						on your system.
					</Text>
					<Box marginTop={1}>
						<Text>
							To enable autonomous operation, Ralph uses flags that bypass permission prompts:
						</Text>
					</Box>
					<Box marginTop={1} flexDirection="column" paddingLeft={2}>
						<Text color="cyan">
							{" "}
							- Cursor: <Text dimColor>--force</Text>
						</Text>
						<Text color="cyan">
							{" "}
							- Claude Code: <Text dimColor>--dangerously-skip-permissions</Text>
						</Text>
						<Text color="cyan">
							{" "}
							- Codex: <Text dimColor>--full-auto</Text>
						</Text>
					</Box>
					<Box marginTop={1} flexDirection="column">
						<Text>This means the AI agent can:</Text>
						<Text dimColor> - Run any shell command without asking</Text>
						<Text dimColor> - Read, write, and delete files</Text>
						<Text dimColor> - Install packages and modify your system</Text>
						<Text dimColor> - Make network requests</Text>
					</Box>
					<Box marginTop={1}>
						<Text bold color="yellow">
							Only use Ralph in projects where you trust the AI to make changes.
						</Text>
					</Box>
				</Box>
			</Box>
			<SelectInput items={CONSENT_CHOICES} onSelect={handleSelect} />
		</Box>
	);

	const renderConfirm = (): React.ReactElement => (
		<Box flexDirection="column" gap={1}>
			<Text>
				Type{" "}
				<Text bold color="cyan">
					"I understand"
				</Text>{" "}
				to confirm you accept these risks:
			</Text>
			<Box>
				<Text color="gray">&gt; </Text>
				<TextInput
					value={confirmInput}
					onChange={(value) => {
						setConfirmInput(value);
						setShowError(false);
					}}
					onSubmit={handleConfirmSubmit}
					placeholder="I understand"
				/>
			</Box>
			{showError && (
				<Text color="red">
					Please type "I understand" exactly to proceed, or press Esc to go back.
				</Text>
			)}
			<Text dimColor>Press Esc to go back</Text>
		</Box>
	);

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text bold>First-Run Safety Notice</Text>
				</Box>
				{step === "warning" ? renderWarning() : renderConfirm()}
			</Box>
		</Box>
	);
}
