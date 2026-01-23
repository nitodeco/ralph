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
								Ralph runs AI agents with{" "}
								<Text bold color="red">
									permission prompts bypassed
								</Text>
								, allowing them to execute code, modify files, and make system changes without
								confirmation.
							</Text>
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
