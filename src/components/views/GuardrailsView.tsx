import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { TextInput } from "@/components/common/TextInput.tsx";
import {
	addGuardrail,
	loadGuardrails,
	removeGuardrail,
	toggleGuardrail,
} from "@/lib/guardrails.ts";
import type { PromptGuardrail } from "@/types/config.types.ts";

interface GuardrailsViewProps {
	version: string;
	onClose: () => void;
}

type ViewMode = "list" | "add";

export function GuardrailsView({ version, onClose }: GuardrailsViewProps): React.ReactElement {
	const [guardrails, setGuardrails] = useState<PromptGuardrail[]>(() => loadGuardrails());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [newInstruction, setNewInstruction] = useState("");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const refreshGuardrails = () => {
		setGuardrails(loadGuardrails());
	};

	const showMessage = (type: "success" | "error", text: string) => {
		setMessage({ type, text });
		setTimeout(() => setMessage(null), 3000);
	};

	useInput((input, key) => {
		if (viewMode === "add") {
			if (key.escape) {
				setViewMode("list");
				setNewInstruction("");
			}
			return;
		}

		if (key.escape || input === "q") {
			onClose();
			return;
		}

		if (key.upArrow && selectedIndex > 0) {
			setSelectedIndex(selectedIndex - 1);
		}

		if (key.downArrow && selectedIndex < guardrails.length - 1) {
			setSelectedIndex(selectedIndex + 1);
		}

		if (input === "a") {
			setViewMode("add");
		}

		if (input === "t" && guardrails.length > 0) {
			const guardrail = guardrails[selectedIndex];
			if (guardrail) {
				toggleGuardrail(guardrail.id);
				refreshGuardrails();
				showMessage("success", `Guardrail ${guardrail.enabled ? "disabled" : "enabled"}`);
			}
		}

		if (input === "d" && guardrails.length > 0) {
			const guardrail = guardrails[selectedIndex];
			if (guardrail) {
				removeGuardrail(guardrail.id);
				refreshGuardrails();
				if (selectedIndex >= guardrails.length - 1) {
					setSelectedIndex(Math.max(0, guardrails.length - 2));
				}
				showMessage("success", "Guardrail removed");
			}
		}
	});

	const handleAddSubmit = (value: string) => {
		if (value.trim()) {
			addGuardrail({ instruction: value.trim() });
			refreshGuardrails();
			showMessage("success", "Guardrail added");
		}
		setNewInstruction("");
		setViewMode("list");
	};

	const enabledCount = guardrails.filter((guardrail) => guardrail.enabled).length;

	return (
		<Box flexDirection="column" padding={1}>
			<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
				<Text bold color="cyan">
					◆ ralph v{version} - Guardrails
				</Text>
			</Box>

			<Box flexDirection="column" marginTop={1} paddingX={1} gap={1}>
				{viewMode === "add" ? (
					<Box flexDirection="column">
						<Text bold color="yellow">
							Add New Guardrail:
						</Text>
						<Box marginTop={1} gap={1}>
							<Text color="cyan">❯</Text>
							<TextInput
								value={newInstruction}
								onChange={setNewInstruction}
								onSubmit={handleAddSubmit}
								placeholder="Enter guardrail instruction..."
							/>
						</Box>
						<Box marginTop={1}>
							<Text dimColor>Press Enter to add, Escape to cancel</Text>
						</Box>
					</Box>
				) : (
					<>
						<Box flexDirection="column">
							<Text bold color="yellow">
								Guardrails ({enabledCount}/{guardrails.length} enabled):
							</Text>
							<Box flexDirection="column" marginTop={1}>
								{guardrails.length === 0 ? (
									<Text dimColor>No guardrails configured. Press 'a' to add one.</Text>
								) : (
									guardrails.map((guardrail, index) => {
										const isSelected = index === selectedIndex;
										const statusIcon = guardrail.enabled ? "✓" : "○";
										const statusColor = guardrail.enabled ? "green" : "gray";

										return (
											<Box key={guardrail.id} flexDirection="column">
												<Box>
													<Text color={isSelected ? "cyan" : undefined}>
														{isSelected ? "❯ " : "  "}
													</Text>
													<Text color={statusColor}>{statusIcon} </Text>
													<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
														{guardrail.instruction}
													</Text>
													<Text dimColor> [{guardrail.category}]</Text>
												</Box>
												{isSelected && (
													<Box paddingLeft={4}>
														<Text dimColor>id: {guardrail.id}</Text>
													</Box>
												)}
											</Box>
										);
									})
								)}
							</Box>
						</Box>

						{message && (
							<Box marginTop={1}>
								<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
							</Box>
						)}

						<Box flexDirection="column" marginTop={1}>
							<Text dimColor>↑/↓ Navigate | a Add | t Toggle | d Delete | q/Esc Close</Text>
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
}
