import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog.tsx";
import { ResponsiveLayout } from "@/components/common/ResponsiveLayout.tsx";
import { ScrollableContent } from "@/components/common/ScrollableContent.tsx";
import { TextInput } from "@/components/common/TextInput.tsx";
import { getGuardrailsService, type PromptGuardrail } from "@/lib/services/index.ts";

interface GuardrailsViewProps {
	version: string;
	onClose: () => void;
}

type ViewMode = "list" | "add" | "confirm-delete";

function GuardrailsHeader({ version }: { version: string }): React.ReactElement {
	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
			<Text bold color="cyan">
				◆ ralph v{version} - Guardrails
			</Text>
		</Box>
	);
}

interface GuardrailsFooterProps {
	viewMode: ViewMode;
}

function GuardrailsFooter({ viewMode }: GuardrailsFooterProps): React.ReactElement {
	if (viewMode === "add") {
		return (
			<Box paddingX={1}>
				<Text dimColor>Press Enter to add, Escape to cancel</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1}>
			<Text dimColor>↑/↓ Navigate | a Add | t Toggle | d Delete | q/Esc Close</Text>
		</Box>
	);
}

export function GuardrailsView({ version, onClose }: GuardrailsViewProps): React.ReactElement {
	const guardrailsService = getGuardrailsService();
	const [guardrails, setGuardrails] = useState<PromptGuardrail[]>(() => guardrailsService.get());
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [viewMode, setViewMode] = useState<ViewMode>("list");
	const [newInstruction, setNewInstruction] = useState("");
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const refreshGuardrails = () => {
		guardrailsService.invalidate();
		setGuardrails(guardrailsService.get());
	};

	const showMessage = (type: "success" | "error", text: string) => {
		setMessage({ type, text });
		setTimeout(() => setMessage(null), 3000);
	};

	useInput((input, key) => {
		if (viewMode === "confirm-delete") {
			if (key.escape) {
				setViewMode("list");

				return;
			}

			if (key.return) {
				const guardrail = guardrails[selectedIndex];

				if (guardrail) {
					guardrailsService.remove(guardrail.id);
					refreshGuardrails();

					if (selectedIndex >= guardrails.length - 1) {
						setSelectedIndex(Math.max(0, guardrails.length - 2));
					}

					showMessage("success", "Guardrail removed");
				}

				setViewMode("list");
			}

			return;
		}

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
				guardrailsService.toggle(guardrail.id);
				refreshGuardrails();
				showMessage("success", `Guardrail ${guardrail.enabled ? "disabled" : "enabled"}`);
			}
		}

		if (input === "d" && guardrails.length > 0) {
			setViewMode("confirm-delete");
		}
	});

	const handleAddSubmit = (value: string) => {
		if (value.trim()) {
			guardrailsService.add({ instruction: value.trim() });
			refreshGuardrails();
			showMessage("success", "Guardrail added");
		}

		setNewInstruction("");
		setViewMode("list");
	};

	const enabledCount = guardrails.filter((guardrail) => guardrail.enabled).length;

	return (
		<ResponsiveLayout
			header={<GuardrailsHeader version={version} />}
			content={
				<ScrollableContent>
					<Box flexDirection="column" paddingX={1} gap={1}>
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

								{viewMode === "confirm-delete" && guardrails[selectedIndex] && (
									<ConfirmationDialog
										title="Delete guardrail?"
										message={`"${guardrails[selectedIndex]?.instruction}"`}
									/>
								)}

								{message && (
									<Box marginTop={1}>
										<Text color={message.type === "success" ? "green" : "red"}>{message.text}</Text>
									</Box>
								)}
							</>
						)}
					</Box>
				</ScrollableContent>
			}
			footer={<GuardrailsFooter viewMode={viewMode} />}
			headerHeight={3}
			footerHeight={2}
		/>
	);
}
