import { Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import { acknowledgeWarning } from "@/lib/config.ts";
import { Header } from "./Header.tsx";

interface ConsentWarningProps {
	version: string;
	onAccept: () => void;
}

const CONSENT_CHOICES = [
	{ label: "I understand the risks", value: "accept" as const },
	{ label: "Exit", value: "exit" as const },
];

export function ConsentWarning({ version, onAccept }: ConsentWarningProps): React.ReactElement {
	const { exit } = useApp();

	const handleSelect = (item: { value: "accept" | "exit" }) => {
		if (item.value === "exit") {
			exit();

			return;
		}

		acknowledgeWarning();
		onAccept();
	};

	useInput((_, key) => {
		if (key.escape) {
			exit();
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Header version={version} />
			<Box flexDirection="column" marginTop={1} paddingX={1}>
				<Box marginBottom={1}>
					<Text bold>First-Run Safety Notice</Text>
				</Box>
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
			</Box>
		</Box>
	);
}
